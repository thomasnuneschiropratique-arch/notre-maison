// Convertit textures et vignettes en WebP, et crée une version légère des textures pour les téléphones.
// Usage : node tools/optimize_assets.mjs
import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const PUB = new URL('../public/', import.meta.url).pathname;
const Q = { diff: 80, nor: 86, rough: 70 };
let before = 0, after = 0, small = 0;

async function textures() {
  const root = join(PUB, 'textures');
  for (const dir of readdirSync(root)) {
    const d = join(root, dir);
    if (!statSync(d).isDirectory()) continue;
    for (const f of readdirSync(d)) {
      if (!f.endsWith('.jpg')) continue;
      const name = f.replace('.jpg', ''), src = join(d, f), big = join(d, `${name}.webp`), sm = join(PUB, 'textures-s', dir, `${name}.webp`);
      mkdirSync(dirname(sm), { recursive: true });
      const q = Q[name] ?? 78;
      before += statSync(src).size;
      await sharp(src).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toFile(big);
      await sharp(src).resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).webp({ quality: q - 8, effort: 5 }).toFile(sm);
      after += statSync(big).size; small += statSync(sm).size;
      rmSync(src);
    }
  }
}

async function thumbs() {
  const root = join(PUB, 'thumbs');
  for (const f of readdirSync(root)) {
    if (!f.endsWith('.png')) continue;
    const src = join(root, f), out = join(root, f.replace('.png', '.webp'));
    before += statSync(src).size;
    await sharp(src).webp({ quality: 80, alphaQuality: 90, effort: 5 }).toFile(out);
    after += statSync(out).size;
    rmSync(src);
  }
}

if (existsSync(join(PUB, 'textures'))) await textures();
await thumbs();
const mb = (n) => `${(n / 1e6).toFixed(1)} Mo`;
console.log(`Avant ${mb(before)} · après ${mb(after)} · version téléphone ${mb(small)}`);
