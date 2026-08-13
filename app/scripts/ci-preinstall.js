#!/usr/bin/env node
/**
 * CI pre-install helper.
 *
 * On Linux runners, electron-builder may need a few system packages that are
 * not installed by default on `ubuntu-latest` (notably `fakeroot` for the .deb
 * target and `libfuse2` for the AppImage toolchain). This script installs them
 * best-effort (failures are ignored so local/dev builds are unaffected).
 *
 * It is invoked from the `rebuild` npm script, which the GitHub Actions
 * workflow runs before `electron-builder`.
 */
import { execSync } from 'child_process';
import os from 'os';

const platform = os.platform();

if (platform === 'linux') {
  const pkgs = ['fakeroot', 'libfuse2'];
  const missing = pkgs.filter((p) => {
    try {
      execSync(`dpkg -s ${p} 2>/dev/null | grep -q '^Status: install ok installed'`, {
        stdio: 'ignore',
      });
      return false;
    } catch {
      return true;
    }
  });

  if (missing.length > 0) {
    console.log(`[ci-preinstall] Installing Linux packaging deps: ${missing.join(', ')}`);
    try {
      execSync('sudo apt-get update -y', { stdio: 'inherit' });
      execSync(`sudo apt-get install -y --no-install-recommends ${missing.join(' ')}`, {
        stdio: 'inherit',
      });
    } catch (err) {
      console.warn(`[ci-preinstall] Could not install ${missing.join(', ')} (continuing): ${err.message}`);
    }
  } else {
    console.log('[ci-preinstall] Linux packaging deps already present.');
  }
} else {
  console.log(`[ci-preinstall] No extra deps needed on ${platform}.`);
}
