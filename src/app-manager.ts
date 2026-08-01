import * as fs from 'fs';
import { mkdtempSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { execFileSync, spawn, spawnSync } from 'child_process';
import https from 'https';

const APP_DIR = path.join(os.homedir(), '.speakeasy');
const APP_PATH = path.join(APP_DIR, 'SpeakEasy.app');
const VERSION_FILE = path.join(APP_DIR, '.app-version');

const GITHUB_REPO = 'arach/SpeakEasy';
const RELEASE_APP_ASSET_NAMES = ['SpeakEasy.dmg'];
const EXPECTED_DEVELOPER_TEAM_ID = '2U83JFPW66';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: ReleaseAsset[];
}

export function isAppInstalled(): boolean {
  return fs.existsSync(APP_PATH) && fs.existsSync(path.join(APP_PATH, 'Contents', 'MacOS', 'SpeakEasy'));
}

/** Absolute path to the installed SpeakEasy.app bundle. */
export function getAppPath(): string {
  return APP_PATH;
}

/**
 * Version recorded at install time (~/.speakeasy/.app-version).
 * Falls back to CFBundleShortVersionString from the app bundle when the tracker is missing.
 */
export function getInstalledVersion(): string | null {
  if (fs.existsSync(VERSION_FILE)) {
    return fs.readFileSync(VERSION_FILE, 'utf8').trim();
  }
  return readBundleShortVersion();
}

function readBundleShortVersion(): string | null {
  const plist = path.join(APP_PATH, 'Contents', 'Info.plist');
  if (!fs.existsSync(plist)) return null;
  try {
    const version = execFileSync(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleShortVersionString', plist],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    return version || null;
  } catch {
    return null;
  }
}

/** Emit version + install path lines after install/open/update. */
export function reportAppLocation(onProgress?: (msg: string) => void, headline?: string): void {
  if (!onProgress) return;
  if (headline) onProgress(headline);
  const version = getInstalledVersion() ?? 'unknown';
  onProgress(`   Version: ${version}`);
  onProgress(`   Path:    ${APP_PATH}`);
}

function ensureAppDir(): void {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'speakeasy-cli' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          fetchJson<T>(location).then(resolve).catch(reject);
          return;
        }
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse JSON: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = (downloadUrl: string) => {
      https.get(downloadUrl, { headers: { 'User-Agent': 'speakeasy-cli' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) {
            request(location);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

function findAppAsset(assets: ReleaseAsset[]): ReleaseAsset | undefined {
  return assets.find((asset) =>
    RELEASE_APP_ASSET_NAMES.includes(asset.name)
    || (asset.name.endsWith('.dmg') && asset.name.startsWith('SpeakEasy'))
  );
}

function verifyAppBundle(bundlePath: string): void {
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', bundlePath], {
    stdio: 'pipe',
  });

  const details = spawnSync('/usr/bin/codesign', ['--display', '--verbose=4', bundlePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (details.status !== 0) {
    throw new Error('Could not inspect the SpeakEasy app signature');
  }

  const signatureOutput = `${details.stdout}\n${details.stderr}`;
  const teamIdentifier = signatureOutput.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim();
  if (teamIdentifier !== EXPECTED_DEVELOPER_TEAM_ID) {
    throw new Error(
      `SpeakEasy app signature has unexpected TeamIdentifier ${teamIdentifier ?? 'missing'}`
    );
  }
}

function verifyDiskImage(dmgPath: string): void {
  execFileSync('/usr/bin/codesign', ['--verify', '--verbose=2', dmgPath], { stdio: 'pipe' });
  execFileSync(
    '/usr/sbin/spctl',
    ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=4', dmgPath],
    { stdio: 'pipe' }
  );
}

function replaceInstalledBundle(sourceBundle: string): void {
  const stagingPath = path.join(APP_DIR, `.SpeakEasy.app.installing-${randomUUID()}`);
  const backupPath = path.join(APP_DIR, `.SpeakEasy.app.backup-${randomUUID()}`);
  let movedExistingBundle = false;
  let installedReplacement = false;

  try {
    execFileSync('/usr/bin/ditto', [sourceBundle, stagingPath], { stdio: 'pipe' });
    verifyAppBundle(stagingPath);

    if (fs.existsSync(APP_PATH)) {
      fs.renameSync(APP_PATH, backupPath);
      movedExistingBundle = true;
    }

    fs.renameSync(stagingPath, APP_PATH);
    installedReplacement = true;
    if (movedExistingBundle) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }
  } catch (error) {
    if (installedReplacement && fs.existsSync(APP_PATH)) {
      fs.rmSync(APP_PATH, { recursive: true, force: true });
    }
    if (movedExistingBundle && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, APP_PATH);
    }
    throw error;
  } finally {
    fs.rmSync(stagingPath, { recursive: true, force: true });
    if (!movedExistingBundle) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }
  }
}

function installBundleFromDmg(dmgPath: string): void {
  const mountPoint = mkdtempSync(path.join(os.tmpdir(), 'speakeasy-mount-'));
  try {
    verifyDiskImage(dmgPath);
    execFileSync(
      '/usr/bin/hdiutil',
      ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPoint, dmgPath],
      { stdio: 'pipe' }
    );
    const mountedBundle = path.join(mountPoint, 'SpeakEasy.app');
    if (!fs.existsSync(mountedBundle)) {
      throw new Error('SpeakEasy.app not found in mounted disk image');
    }
    verifyAppBundle(mountedBundle);
    replaceInstalledBundle(mountedBundle);
  } finally {
    try {
      execFileSync('/usr/bin/hdiutil', ['detach', mountPoint, '-quiet'], { stdio: 'pipe' });
    } catch {
      // Ignore detach failures after a successful copy.
    }
    fs.rmSync(mountPoint, { recursive: true, force: true });
  }
}

export async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    return await fetchJson<GitHubRelease>(url);
  } catch {
    return null;
  }
}

export async function downloadAndInstallApp(onProgress?: (msg: string) => void): Promise<boolean> {
  if (process.platform !== 'darwin') {
    onProgress?.('⚠️  Settings app is only available on macOS');
    return false;
  }

  ensureAppDir();

  onProgress?.('🔍 Checking for latest release...');

  const release = await getLatestRelease();
  if (!release) {
    onProgress?.('❌ Could not fetch release info from GitHub');
    return false;
  }

  const dmgAsset = findAppAsset(release.assets);
  if (!dmgAsset) {
    onProgress?.('❌ No signed macOS disk image found in latest release');
    onProgress?.('   Available assets: ' + release.assets.map((asset) => asset.name).join(', '));
    return false;
  }

  onProgress?.(`📥 Downloading ${dmgAsset.name}...`);

  try {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'speakeasy-download-'));
    const dmgPath = path.join(tempDir, dmgAsset.name);
    try {
      await downloadFile(dmgAsset.browser_download_url, dmgPath);
      onProgress?.('🔐 Verifying signed and notarized disk image...');
      installBundleFromDmg(dmgPath);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    onProgress?.(`❌ Install failed: ${(error as Error).message}`);
    return false;
  }

  fs.writeFileSync(VERSION_FILE, release.tag_name);

  reportAppLocation(onProgress, `✅ Installed SpeakEasy.app (${release.tag_name})`);
  return true;
}

export async function ensureAppInstalled(onProgress?: (msg: string) => void): Promise<boolean> {
  if (isAppInstalled()) {
    return true;
  }

  onProgress?.('🚀 First run: Installing SpeakEasy settings app...');
  return await downloadAndInstallApp(onProgress);
}

export function launchApp(onProgress?: (msg: string) => void): boolean {
  if (!isAppInstalled()) {
    console.error('❌ SpeakEasy.app is not installed');
    console.error('   Run: speakeasy --app to install and launch');
    return false;
  }

  try {
    spawn('open', [APP_PATH], { detached: true, stdio: 'ignore' }).unref();
    reportAppLocation(onProgress, '🚀 Opened SpeakEasy settings app');
    return true;
  } catch (error) {
    console.error('❌ Failed to launch app:', (error as Error).message);
    return false;
  }
}

export async function updateApp(onProgress?: (msg: string) => void): Promise<boolean> {
  const installedVersion = getInstalledVersion();
  const release = await getLatestRelease();

  if (!release) {
    onProgress?.('❌ Could not check for updates');
    return false;
  }

  if (installedVersion === release.tag_name) {
    reportAppLocation(onProgress, `✅ Already up to date (${installedVersion})`);
    return true;
  }

  onProgress?.(`📦 Updating from ${installedVersion || 'unknown'} to ${release.tag_name}...`);
  return await downloadAndInstallApp(onProgress);
}
