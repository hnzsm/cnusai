import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Regenerate the social-share cover (og-cover.png, 1200x630) from og-cover.svg.
// Run manually with: node scripts/build-og.mjs   (requires the `sharp`
// devDependency; this is NOT part of the Cloudflare Pages deploy build.)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(ROOT, 'og-cover.svg'));

sharp(svg, { density: 150 })
  .resize(1200, 630)
  .png()
  .toFile(path.join(ROOT, 'og-cover.png'))
  .then((i) => console.log(`og-cover.png ${i.width}x${i.height} ${i.size}B`))
  .catch((e) => { console.error('FAILED', e.message); process.exit(1); });
