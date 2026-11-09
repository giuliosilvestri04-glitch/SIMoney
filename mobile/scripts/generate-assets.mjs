/**
 * Generatore delle icone dell'app — nessuna dipendenza esterna.
 *
 * Produce i PNG richiesti da Expo (icona, icona adattiva Android, splash,
 * favicon) disegnando un semplice marchio: un grafico ascendente su fondo blu
 * notte, coerente con la palette dell'app.
 *
 * Uso:  node scripts/generate-assets.mjs
 *
 * Nota per la consegna: icona e nome sono segnaposto del prototipo; vanno
 * sostituiti con il marchio dell'azienda prima della demo, se richiesto.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(OUT, { recursive: true });

const NAVY = [15, 39, 64, 255];
const WHITE = [255, 255, 255, 255];
const ACCENT = [56, 132, 255, 255];
const CLEAR = [0, 0, 0, 0];

// --- Encoder PNG minimale (RGBA, non interlacciato) -------------------------

function crc32(buffer) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Disegno ----------------------------------------------------------------

function createCanvas(size, background) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    pixels[i * 4] = background[0];
    pixels[i * 4 + 1] = background[1];
    pixels[i * 4 + 2] = background[2];
    pixels[i * 4 + 3] = background[3];
  }
  return pixels;
}

/** Fusione di un colore con antialiasing (copertura 0..1). */
function blend(pixels, size, x, y, color, coverage) {
  if (x < 0 || y < 0 || x >= size || y >= size || coverage <= 0) return;
  const i = (y * size + x) * 4;
  const a = Math.min(1, coverage) * (color[3] / 255);
  const dstA = pixels[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA === 0) return;
  for (let c = 0; c < 3; c += 1) {
    pixels[i + c] = Math.round((color[c] * a + pixels[i + c] * dstA * (1 - a)) / outA);
  }
  pixels[i + 3] = Math.round(outA * 255);
}

/** Segmento di retta con spessore e estremi arrotondati. */
function drawLine(pixels, size, x0, y0, x1, y1, thickness, color) {
  const half = thickness / 2;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half - 1));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1) + half + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half - 1));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1) + half + 1));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSq = dx * dx + dy * dy || 1;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / lengthSq));
      const px = x0 + t * dx;
      const py = y0 + t * dy;
      const distance = Math.hypot(x - px, y - py);
      blend(pixels, size, x, y, color, half + 0.5 - distance);
    }
  }
}

function drawCircle(pixels, size, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y += 1) {
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x += 1) {
      blend(pixels, size, x, y, color, radius + 0.5 - Math.hypot(x - cx, y - cy));
    }
  }
}

function drawRoundedRect(pixels, size, x0, y0, x1, y1, radius, color) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y += 1) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x += 1) {
      const cx = Math.min(Math.max(x, x0 + radius), x1 - radius);
      const cy = Math.min(Math.max(y, y0 + radius), y1 - radius);
      const distance = Math.hypot(x - cx, y - cy);
      blend(pixels, size, x, y, color, radius + 0.5 - distance);
    }
  }
}

/**
 * Marchio: barre crescenti + linea di tendenza ascendente.
 * `scale` definisce quanto il marchio occupa del lato (zona sicura).
 */
function drawMark(pixels, size, scale, color, accent) {
  const inner = size * scale;
  const offset = (size - inner) / 2;
  const px = (v) => offset + inner * v;

  // Barre
  const bars = [
    { x: 0.1, h: 0.34 },
    { x: 0.36, h: 0.55 },
    { x: 0.62, h: 0.78 },
  ];
  const barWidth = inner * 0.16;
  for (const bar of bars) {
    drawRoundedRect(
      pixels,
      size,
      px(bar.x),
      px(1 - bar.h),
      px(bar.x) + barWidth,
      px(0.98),
      barWidth * 0.42,
      color,
    );
  }

  // Linea di tendenza
  const points = [
    [px(0.06), px(0.52)],
    [px(0.36), px(0.3)],
    [px(0.62), px(0.38)],
    [px(0.94), px(0.08)],
  ];
  for (let i = 1; i < points.length; i += 1) {
    drawLine(pixels, size, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], inner * 0.075, accent);
  }
  drawCircle(pixels, size, points[points.length - 1][0], points[points.length - 1][1], inner * 0.07, accent);
}

function write(name, width, height, pixels) {
  writeFileSync(resolve(OUT, name), encodePng(width, height, pixels));
  console.log(`  ✓ assets/${name}`);
}

console.log('Generazione icone dell\'app:');

// Icona principale (iOS + fallback Android)
{
  const size = 1024;
  const pixels = createCanvas(size, NAVY);
  drawMark(pixels, size, 0.6, WHITE, ACCENT);
  write('icon.png', size, size, pixels);
}

// Icona adattiva Android: sfondo e primo piano separati
{
  const size = 1024;
  write('android-icon-background.png', size, size, createCanvas(size, NAVY));

  const foreground = createCanvas(size, CLEAR);
  drawMark(foreground, size, 0.44, WHITE, ACCENT); // zona sicura del 66%
  write('android-icon-foreground.png', size, size, foreground);

  const monochrome = createCanvas(size, CLEAR);
  drawMark(monochrome, size, 0.44, WHITE, WHITE);
  write('android-icon-monochrome.png', size, size, monochrome);
}

// Splash
{
  const size = 512;
  const pixels = createCanvas(size, CLEAR);
  drawMark(pixels, size, 0.66, WHITE, ACCENT);
  write('splash-icon.png', size, size, pixels);
}

// Favicon (solo build web di sviluppo)
{
  const size = 64;
  const pixels = createCanvas(size, NAVY);
  drawMark(pixels, size, 0.62, WHITE, ACCENT);
  write('favicon.png', size, size, pixels);
}

console.log('Fatto.\n');
