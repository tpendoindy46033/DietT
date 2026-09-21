import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { encodePng } from "./pngEncoder.mjs";
import { publicDir } from "./paths.mjs";

const BG = [15, 118, 110, 255]; // teal accent
const FG = [255, 255, 255, 255]; // white leaf mark

/** Draws a simple leaf mark (two intersecting circles + stem) into an RGBA buffer. */
function drawIcon(size, { maskable = false } = {}) {
  const rgba = new Uint8Array(size * size * 4);
  const pad = maskable ? size * 0.2 : 0; // safe zone for maskable icons
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - pad * 2) * 0.34;
  const offset = r * 0.62;
  const angle = -Math.PI / 4;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Petal centers in rotated space, then rotated back into screen space.
  const c1 = rotate(-offset, 0, cos, sin);
  const c2 = rotate(offset, 0, cos, sin);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const inLeaf = dist(dx, dy, c1[0], c1[1]) <= r * 1.18 && dist(dx, dy, c2[0], c2[1]) <= r * 1.18;
      const stem = distToSegment(dx, dy, 0, r * 0.55, r * 0.95, r * 1.55) <= size * 0.02;

      const idx = (y * size + x) * 4;
      const color = inLeaf || stem ? FG : BG;
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = color[3];
    }
  }

  return rgba;
}

function rotate(x, y, cos, sin) {
  return [x * cos - y * sin, x * sin + y * cos];
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return dist(px, py, projX, projY);
}

export async function generateIcons() {
  const iconsDir = resolve(publicDir, "icons");
  await mkdir(iconsDir, { recursive: true });

  const targets = [
    { name: "icon-192.png", size: 192, maskable: false },
    { name: "icon-512.png", size: 512, maskable: false },
    { name: "maskable-512.png", size: 512, maskable: true }
  ];

  for (const target of targets) {
    const rgba = drawIcon(target.size, { maskable: target.maskable });
    const png = encodePng(target.size, target.size, rgba);
    await writeFile(resolve(iconsDir, target.name), png);
  }

  return targets.map((t) => t.name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateIcons().then((names) => console.log(`Generated icons: ${names.join(", ")}`));
}
