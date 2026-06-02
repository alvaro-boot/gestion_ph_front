import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const linkPath = path.join(root, '.next');

const cacheDirs = [
  path.join(root, 'node_modules', '.cache'),
  path.join(process.env.LOCALAPPDATA || os.homedir(), 'boot-bitacora-next'),
  path.join(os.tmpdir(), 'boot-bitacora-next'),
];

function removeNext() {
  if (!fs.existsSync(linkPath)) return;
  if (process.platform === 'win32') {
    try {
      execSync(`cmd /c rmdir "${linkPath}"`, { stdio: 'ignore' });
      console.log('Enlace/junction .next eliminado');
    } catch {
      fs.rmSync(linkPath, { recursive: true, force: true });
      console.log('Carpeta .next eliminada');
    }
    return;
  }
  fs.rmSync(linkPath, { recursive: true, force: true });
  console.log('Carpeta .next eliminada');
}

removeNext();

for (const dir of cacheDirs) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('Eliminado:', dir);
  } catch {
    /* ignore */
  }
}

console.log('Limpieza lista.');
