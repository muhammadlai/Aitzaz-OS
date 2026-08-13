#!/usr/bin/env node
/**
 * CI pre-install helper.
 *
 * On Linux runners, electron-builder needs a few system packages that are not
 * installed by default on `ubuntu-latest`:
 *   - `fakeroot`  -> required by the `.deb` (fpm) target
 *   - `dpkg`      -> required to assemble the Debian control archive
 *   - `libfuse2`  -> required by the AppImage toolchain (package renamed to
 *                    `libfuse2t64` on Ubuntu 24.04, so try both names)
 *
 * Also prepares files electron-builder copies via extraResources and exports
 * APPIMAGE_EXTRACT_AND_RUN so appimagetool can run on GitHub-hosted runners
 * that do not provide a usable FUSE device.
 *
 * This script is invoked from the `rebuild` npm script, which the GitHub
 * Actions workflow runs before `electron-builder`.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

function aptInstall(pkgs) {
  execSync(`sudo apt-get install -y --no-install-recommends ${pkgs.join(' ')}`, {
    stdio: 'inherit',
  });
}

function appendGithubEnv(line) {
  const envFile = process.env.GITHUB_ENV;
  if (!envFile) return;
  fs.appendFileSync(envFile, `${line}\n`);
  console.log(`[ci-preinstall] Exported ${line} via GITHUB_ENV`);
}

function ensurePackagingInputs() {
  const root = process.cwd();
  const configPath = path.join(root, 'app-config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        { VITE_GOOGLE_CLIENT_ID: '', VITE_GOOGLE_CLIENT_SECRET: '' },
        null,
        2,
      ) + '\n',
    );
    console.log('[ci-preinstall] Wrote empty app-config.json');
  }

  for (const rel of ['backend/lib', 'backend/models', 'resources/backend']) {
    const dir = path.join(root, rel);
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensurePackagingInputs();

if (platform === 'linux') {
  // AppImage's bundled appimagetool is itself an AppImage and needs this
  // on GitHub-hosted Ubuntu runners (no /dev/fuse).
  appendGithubEnv('APPIMAGE_EXTRACT_AND_RUN=1');
  process.env.APPIMAGE_EXTRACT_AND_RUN = '1';

  const required = ['fakeroot', 'dpkg'];
  const fuseCandidates = ['libfuse2t64', 'libfuse2'];
  const optional = ['rpm', 'libarchive-tools', 'xz-utils'];

  const missingRequired = required.filter((p) => !isInstalled(p));
  const missingOptional = optional.filter((p) => !isInstalled(p));
  const fusePresent = fuseCandidates.some((p) => isInstalled(p));

  if (missingRequired.length > 0 || missingOptional.length > 0 || !fusePresent) {
    console.log('[ci-preinstall] Updating apt package lists');
    try {
      execSync('sudo apt-get update -y', { stdio: 'inherit' });
    } catch (e) {
      console.warn(`[ci-preinstall] apt-get update failed (continuing): ${e.message}`);
    }
  }

  if (missingRequired.length > 0) {
    console.log(`[ci-preinstall] Installing required packaging deps: ${missingRequired.join(', ')}`);
    try {
      aptInstall(missingRequired);
    } catch (err) {
      console.warn(`[ci-preinstall] Batch install failed: ${err.message}`);
      for (const p of missingRequired) {
        try {
          aptInstall([p]);
        } catch (e) {
          console.error(`[ci-preinstall] Failed to install required package ${p}: ${e.message}`);
          process.exit(1);
        }
      }
    }
  }

  if (!fusePresent) {
    let installedFuse = false;
    for (const p of fuseCandidates) {
      try {
        console.log(`[ci-preinstall] Installing ${p}`);
        aptInstall([p]);
        installedFuse = true;
        break;
      } catch (e) {
        console.warn(`[ci-preinstall] Could not install ${p}: ${e.message}`);
      }
    }
    if (!installedFuse) {
      console.warn('[ci-preinstall] No libfuse2 package installed; AppImage may fail');
    }
  }

  for (const p of missingOptional) {
    try {
      aptInstall([p]);
    } catch (e) {
      console.warn(`[ci-preinstall] Optional package ${p} skipped: ${e.message}`);
    }
  }

  console.log('[ci-preinstall] Linux packaging deps ready.');
} else {
  console.log(`[ci-preinstall] No extra system deps needed on ${platform}.`);
}
