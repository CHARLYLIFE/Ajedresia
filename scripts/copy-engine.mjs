import { readdir, mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(projectRoot, 'node_modules', 'stockfish');
const outputDir = path.join(projectRoot, 'public', 'engine');
const required = ['stockfish-19-single.js', 'stockfish-19-single.wasm'];

async function walk(dir) {
  const files = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return files; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'examples' || entry.name === 'tests') continue;
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

try { await stat(packageRoot); }
catch {
  console.error('No se encontró node_modules/stockfish. Ejecuta primero: npm install');
  process.exit(1);
}

const files = await walk(packageRoot);
await mkdir(outputDir, { recursive: true });

for (const filename of required) {
  const candidates = files.filter((candidate) => path.basename(candidate) === filename);
  candidates.sort((a, b) => {
    const priority = (file) => file.includes(`${path.sep}bin${path.sep}`) ? 0 : file.includes(`${path.sep}src${path.sep}`) ? 1 : 2;
    return priority(a) - priority(b);
  });
  if (!candidates.length) {
    console.error(`No se encontró ${filename} dentro del paquete Stockfish 19. Comprueba que stockfish@19.0.1 esté instalado.`);
    process.exit(1);
  }
  await copyFile(candidates[0], path.join(outputDir, filename));
  console.log(`Motor copiado: ${path.relative(projectRoot, candidates[0])} -> ${path.relative(projectRoot, path.join(outputDir, filename))}`);
}

const licenseNames = new Set(['copying.txt', 'copying', 'license', 'license.txt', 'gpl-3.0.txt']);
const licenseCandidates = files.filter((candidate) => licenseNames.has(path.basename(candidate).toLowerCase()));
licenseCandidates.sort((a, b) => {
  const priority = (file) => path.dirname(file) === packageRoot ? 0 : 1;
  return priority(a) - priority(b);
});
if (licenseCandidates.length) {
  await copyFile(licenseCandidates[0], path.join(outputDir, 'STOCKFISH-LICENSE.txt'));
}
