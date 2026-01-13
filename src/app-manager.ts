import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import https from 'https';

const APP_DIR = path.join(os.homedir(), '.speakeasy');
const APP_PATH = path.join(APP_DIR, 'SpeakEasy.app');
const VERSION_FILE = path.join(APP_DIR, '.app-version');

// GitHub release info - update these when publishing
const GITHUB_REPO = 'arach/speakeasy';
const APP_VERSION = '1.0.0';

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

export function getInstalledVersion(): string | null {
  if (!fs.existsSync(VERSION_FILE)) return null;
  return fs.readFileSync(VERSION_FILE, 'utf8').trim();
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
        } catch (e) {
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

export async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    return await fetchJson<GitHubRelease>(url);
  } catch (error) {
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

  const appAsset = release.assets.find(a => a.name === 'SpeakEasy.app.zip' || a.name === 'SpeakEasy-macos.zip');
  if (!appAsset) {
    onProgress?.('❌ No macOS app found in latest release');
    onProgress?.('   Available assets: ' + release.assets.map(a => a.name).join(', '));
    return false;
  }

  const zipPath = path.join(APP_DIR, 'SpeakEasy.app.zip');

  onProgress?.(`📥 Downloading ${appAsset.name}...`);

  try {
    await downloadFile(appAsset.browser_download_url, zipPath);
  } catch (error) {
    onProgress?.(`❌ Download failed: ${(error as Error).message}`);
    return false;
  }

  onProgress?.('📦 Installing...');

  // Remove old app if exists
  if (fs.existsSync(APP_PATH)) {
    fs.rmSync(APP_PATH, { recursive: true, force: true });
  }

  // Unzip
  try {
    execSync(`unzip -q -o "${zipPath}" -d "${APP_DIR}"`, { stdio: 'pipe' });
  } catch (error) {
    onProgress?.('❌ Failed to unzip app');
    return false;
  }

  // Clean up zip
  fs.unlinkSync(zipPath);

  // Remove quarantine attribute
  try {
    execSync(`xattr -rd com.apple.quarantine "${APP_PATH}"`, { stdio: 'pipe' });
  } catch {
    // Ignore if xattr fails
  }

  // Save version
  fs.writeFileSync(VERSION_FILE, release.tag_name);

  onProgress?.(`✅ Installed SpeakEasy.app (${release.tag_name})`);
  return true;
}

export async function ensureAppInstalled(onProgress?: (msg: string) => void): Promise<boolean> {
  if (isAppInstalled()) {
    return true;
  }

  onProgress?.('🚀 First run: Installing SpeakEasy settings app...');
  return await downloadAndInstallApp(onProgress);
}

export function launchApp(): boolean {
  if (!isAppInstalled()) {
    console.error('❌ SpeakEasy.app is not installed');
    console.error('   Run: speakeasy --app to install and launch');
    return false;
  }

  try {
    spawn('open', [APP_PATH], { detached: true, stdio: 'ignore' }).unref();
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
    onProgress?.(`✅ Already up to date (${installedVersion})`);
    return true;
  }

  onProgress?.(`📦 Updating from ${installedVersion || 'unknown'} to ${release.tag_name}...`);
  return await downloadAndInstallApp(onProgress);
}
