import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="280" font-weight="bold" fill="white" text-anchor="middle">R</text>
  <path d="M80 380 Q160 340 256 380 T432 380" stroke="white" stroke-width="12" fill="none" opacity="0.6"/>
  <path d="M80 410 Q160 370 256 410 T432 410" stroke="white" stroke-width="10" fill="none" opacity="0.4"/>
</svg>
`;

async function generateIcons() {
  const sizes = [192, 512];
  for (const size of sizes) {
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(PUBLIC_DIR, `icon-${size}.png`));
    console.log(`✓ Generated icon-${size}.png`);
  }

  await sharp(Buffer.from(iconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(PUBLIC_DIR, "favicon.png"));
  console.log("✓ Generated favicon.png");
}

generateIcons().catch(console.error);
