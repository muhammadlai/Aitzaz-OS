#!/usr/bin/env node
/**
 * CI pre-install helper.
 *
 * On Linux runners, electron-builder needs a few system packages that are not
 * installed by default on `ubuntu-latest`:
 *   - `fakeroot`  -> required by the `.deb` (fpm) target
 *   - `libfuse2`  -> required by the AppImage toolchain (package renamed to
 *                    `libfuse2t64` on Ubuntu 24.04, so try both names)
 *
 * This script installs them best-effort (failures are ignored so local/dev
 * builds are unaffected). It is invoked from the `rebuild` npm script, which
 * the GitHub Actions workflow runs before `electron-builder`.
 */
import { execSync } from 'child_process';
import os from 'os';

const platform = os.platform();

function isInstalled(pkg) {
  try {
    execSync(`dpkg -s ${pkg} 2>/dev/null | grep -q '^Status: install ok installed'`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

if (platform === 'linux') {
  // Candidate package names. On Ubuntu 22.04 it is `libfuse2`; on 24.04 it was
  // renamed to `libfuse2t64`. Install whichever is available.
  const wanted = new Set(['fakeroot', 'libfuse2', 'libfuse2t64']);
  const missing = [...wanted].filter((p) => !isInstalled(p));

  if (missing.length > 0) {
    console.log(`[ci-preinstall] Ensuring Linux packaging deps: ${missing.join(', ')}`);
    try {
      execSync('sudo apt-get update -y', { stdio: 'inherit' });
      execSync(`sudo apt-get install -y --no-install-recommends ${missing.join(' ')}`, {
        stdio: 'inherit',
      });
    } catch (err) {
      // Try installing the candidate list in two passes so a missing package
      // name on one distro doesn't block the other.
      for (const p of missing) {
        try {
          execSync(`sudo apt-get install -y --no-install-recommends ${p}`, {
            stdio: 'inherit',
          });
        } catch (e) {
          console.warn(`[ci-preinstall] Could not install ${p} (continuing): ${e.message}`);
        }
      }
    }
  } else {
    console.log('[ci-preinstall] Linux packaging deps already present.');
  }
} else {
  console.log(`[ci-preinstall] No extra deps needed on ${platform}.`);
}
