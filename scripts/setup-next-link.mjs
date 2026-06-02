/**
 * En Windows: .next → AppData\Local (fuera de OneDrive).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const linkPath = path.join(root, '.next');
const targetPath = path.join(
  process.env.LOCALAPPDATA || os.homedir(),
  'boot-bitacora-next',
);

if (process.platform !== 'win32') {
  process.exit(0);
}

fs.mkdirSync(targetPath, { recursive: true });

if (fs.existsSync(linkPath)) {
  try {
    execSync(`cmd /c rmdir "${linkPath}"`, { stdio: 'ignore' });
  } catch {
    try {
      fs.rmSync(linkPath, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

try {
  execSync(`cmd /c mklink /J "${linkPath}" "${targetPath}"`, { stdio: 'pipe' });
  console.log('OK: .next →', targetPath);
} catch (e) {
  console.warn('No se pudo enlazar .next. Usa: npm run dev:prod');
  process.exit(0);
}
