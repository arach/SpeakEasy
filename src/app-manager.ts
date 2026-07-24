import * as fs from 'fs';
import { mkdtempSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import https from 'https';

const APP_DIR = path.join(os.homedir(), '.speakeasy');
const APP_PATH = path.join(APP_DIR, 'SpeakEasy.app');
const VERSION_FILE = path.join(APP_DIR, '.app-version');

const GITHUB_REPO = 'arach/SpeakEasy';
const RELEASE_APP_ASSET_NAMES = ['SpeakEasy.dmg'];

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
    const version = execSync(
      `/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' '${plist}'`,
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

function installBundleFromDmg(dmgPath: string): void {
  const mountPoint = mkdtempSync(path.join(os.tmpdir(), 'speakeasy-mount-'));
  try {
    execSync(`hdiutil attach -nobrowse -readonly -mountpoint '${mountPoint}' '${dmgPath}'`, { stdio: 'pipe' });
    const mountedBundle = path.join(mountPoint, 'SpeakEasy.app');
    if (!fs.existsSync(mountedBundle)) {
      throw new Error('SpeakEasy.app not found in mounted disk image');
    }
    if (fs.existsSync(APP_PATH)) {
      fs.rmSync(APP_PATH, { recursive: true, force: true });
    }
    execSync(`cp -R '${mountedBundle}' '${APP_PATH}'`);
  } finally {
    try {
      execSync(`hdiutil detach '${mountPoint}' -quiet`, { stdio: 'pipe' });
    } catch {
      // Ignore detach failures after a successful copy.
    }
    fs.rmSync(mountPoint, { recursive: true, force: true });
  }
}

async function installFromZip(asset: ReleaseAsset, onProgress?: (msg: string) => void): Promise<boolean> {
  const zipPath = path.join(APP_DIR, asset.name);

  try {
    await downloadFile(asset.browser_download_url, zipPath);
  } catch (error) {
    onProgress?.(`❌ Download failed: ${(error as Error).message}`);
    return false;
  }

  if (fs.existsSync(APP_PATH)) {
    fs.rmSync(APP_PATH, { recursive: true, force: true });
  }

  try {
    execSync(`unzip -q -o "${zipPath}" -d "${APP_DIR}"`, { stdio: 'pipe' });
  } catch {
    onProgress?.('❌ Failed to unzip app');
    return false;
  }

  fs.unlinkSync(zipPath);
  const macosxDir = path.join(APP_DIR, '__MACOSX');
  if (fs.existsSync(macosxDir)) {
    fs.rmSync(macosxDir, { recursive: true, force: true });
  }

  return true;
}

function clearQuarantine(): void {
  try {
    execSync(`xattr -rd com.apple.quarantine "${APP_PATH}"`, { stdio: 'pipe' });
  } catch {
    // Ignore if xattr fails.
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
  const zipAsset = release.assets.find((asset) =>
    asset.name === 'SpeakEasy.app.zip' || asset.name === 'SpeakEasy-macos.zip'
  );

  if (!dmgAsset && !zipAsset) {
    onProgress?.('❌ No macOS app found in latest release');
    onProgress?.('   Available assets: ' + release.assets.map((asset) => asset.name).join(', '));
    return false;
  }

  onProgress?.(`📥 Downloading ${(dmgAsset ?? zipAsset)!.name}...`);

  try {
    if (dmgAsset) {
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'speakeasy-download-'));
      const dmgPath = path.join(tempDir, dmgAsset.name);
      try {
        await downloadFile(dmgAsset.browser_download_url, dmgPath);
        onProgress?.('📦 Installing from disk image...');
        installBundleFromDmg(dmgPath);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } else if (zipAsset) {
      onProgress?.('📦 Installing from zip...');
      const installed = await installFromZip(zipAsset, onProgress);
      if (!installed) return false;
    }
  } catch (error) {
    onProgress?.(`❌ Install failed: ${(error as Error).message}`);
    return false;
  }

  clearQuarantine();
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