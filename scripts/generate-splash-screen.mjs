/**
 * Generates assets/images/splash-full.png — full-screen dawn gradient + centered logo.
 * Run: npm run generate:splash
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'assets/images/splash-full.png');
const logoPath = path.join(root, 'assets/sunvantage-app-icon-1024.png');

const WIDTH = 1284;
const HEIGHT = 2778;
const LOGO_SIZE = 240;

/** Gradient stops blended on Night Calm base #0E223D — matches theme/gradients.ts */
const STOPS = [
  { offset: '0%', color: '#0E223D' },
  { offset: '28%', color: '#1B2851' },
  { offset: '52%', color: '#343263' },
  { offset: '76%', color: '#1A2948' },
  { offset: '100%', color: '#141C32' },
];

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
      ${STOPS.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('\n      ')}
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="62%" r="42%">
      <stop offset="0%" stop-color="rgba(255,179,71,0.14)"/>
      <stop offset="55%" stop-color="rgba(255,179,71,0.04)"/>
      <stop offset="100%" stop-color="rgba(255,179,71,0)"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#dawn)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect x="0" y="${Math.round(HEIGHT * 0.58)}" width="100%" height="3" fill="rgba(255,179,71,0.06)"/>
</svg>
`;

async function main() {
  await mkdir(path.dirname(outPath), { recursive: true });

  const background = await sharp(Buffer.from(svg)).png().toBuffer();

  const logo = await sharp(logoPath)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const left = Math.round((WIDTH - LOGO_SIZE) / 2);
  const top = Math.round(HEIGHT * 0.42 - LOGO_SIZE / 2);

  await sharp(background)
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(`Wrote ${outPath} (${meta.width}x${meta.height})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
