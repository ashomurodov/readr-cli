import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const PACKAGE_NAME = 'readr-cli';
const UPDATE_CACHE_PATH = path.join(os.homedir(), '.reading-cli', 'update-check.json');
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const RETRY_AUTO_UPDATE_MS = 24 * 60 * 60 * 1000;

interface UpdateCache {
  lastCheckedAt?: string;
  latestVersion?: string;
  lastAutoUpdateAttemptAt?: string;
  lastAutoUpdateAttemptVersion?: string;
}

function loadCache(): UpdateCache {
  try {
    if (!fs.existsSync(UPDATE_CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(UPDATE_CACHE_PATH, 'utf-8')) as UpdateCache;
  } catch {
    return {};
  }
}

function saveCache(cache: UpdateCache): void {
  try {
    fs.mkdirSync(path.dirname(UPDATE_CACHE_PATH), { recursive: true });
    fs.writeFileSync(UPDATE_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    // Best-effort cache only.
  }
}

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split('.')
    .map((part) => parseInt(part, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

function compareVersions(a: string, b: string): number {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const left = av[i] ?? 0;
    const right = bv[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

export function getCurrentVersion(): string | null {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

function getLatestVersionFromNpm(): string | null {
  try {
    const result = spawnSync('npm', ['view', PACKAGE_NAME, 'version'], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 3500,
    });
    if (result.status !== 0) return null;
    const version = result.stdout.trim();
    return version || null;
  } catch {
    return null;
  }
}

function tryAutoUpdate(): boolean {
  try {
    const result = spawnSync('npm', ['install', '-g', PACKAGE_NAME], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 120000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function shouldRetryAutoUpdate(cache: UpdateCache, latestVersion: string): boolean {
  if (cache.lastAutoUpdateAttemptVersion !== latestVersion) return true;
  if (!cache.lastAutoUpdateAttemptAt) return true;
  const lastAttempt = new Date(cache.lastAutoUpdateAttemptAt).getTime();
  if (!Number.isFinite(lastAttempt)) return true;
  return Date.now() - lastAttempt > RETRY_AUTO_UPDATE_MS;
}

export function maybeRunUpdateCheck(): void {
  const currentVersion = getCurrentVersion();
  if (!currentVersion) return;

  const cache = loadCache();
  const lastChecked = cache.lastCheckedAt ? new Date(cache.lastCheckedAt).getTime() : 0;
  const shouldCheck = !lastChecked || Date.now() - lastChecked > CHECK_INTERVAL_MS;

  let latestVersion = cache.latestVersion ?? null;
  if (shouldCheck) {
    latestVersion = getLatestVersionFromNpm();
    cache.lastCheckedAt = new Date().toISOString();
    if (latestVersion) {
      cache.latestVersion = latestVersion;
    }
    saveCache(cache);
  }

  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) return;

  let updated = false;
  if (shouldRetryAutoUpdate(cache, latestVersion)) {
    updated = tryAutoUpdate();
    cache.lastAutoUpdateAttemptAt = new Date().toISOString();
    cache.lastAutoUpdateAttemptVersion = latestVersion;
    saveCache(cache);
  }

  if (updated) {
    console.log(chalk.green(`\n  Updated readr-cli to v${latestVersion}.`));
    console.log(chalk.gray('  Run your command again to use the latest version.\n'));
    return;
  }

  console.log(chalk.yellow(`\n  Update available: readr-cli v${latestVersion} (current v${currentVersion}).`));
  console.log(chalk.gray(`  Please run: npm install -g ${PACKAGE_NAME}\n`));
}

