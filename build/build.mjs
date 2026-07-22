import { build as esbuild } from "esbuild";
import { deflateSync } from "node:zlib";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const distRoot = path.join(root, "dist");
const targets = ["chrome", "edge", "firefox", "safari"];

if (process.argv.includes("--clean")) {
  await rm(distRoot, { recursive: true, force: true });
  process.exit(0);
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const baseManifest = await readJson("build/manifests/base.json");

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });

for (const target of targets) {
  const outdir = path.join(distRoot, target);
  await mkdir(outdir, { recursive: true });

  const entryPoints = {
    content: path.join(root, "src/content/content-entry.ts"),
    popup: path.join(root, "src/ui/popup-entry.ts")
  };

  await esbuild({
    entryPoints,
    absWorkingDir: root,
    outdir,
    entryNames: "[name]",
    bundle: true,
    minify: true,
    sourcemap: false,
    format: "iife",
    platform: "browser",
    target: target === "firefox" ? ["firefox140"] : ["es2022"],
    logLevel: "warning",
    legalComments: "none"
  });

  await copyIfExists("public", outdir);
  await copyIfExists("src/_locales", path.join(outdir, "_locales"));
  await generateIcons(path.join(outdir, "icons"));

  const overlay = await readJson(`build/manifests/${target}.json`);
  const manifest = deepMerge(baseManifest, overlay);
  manifest.version = packageJson.version;
  await writeFile(
    path.join(outdir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

const report = {};
for (const target of targets) {
  report[target] = await directorySize(path.join(distRoot, target));
}
await writeFile(
  path.join(distRoot, "build-report.json"),
  `${JSON.stringify({ version: packageJson.version, bytes: report }, null, 2)}\n`,
  "utf8"
);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(sourceRelative, destination) {
  const source = path.join(root, sourceRelative);
  if (await exists(source)) {
    await cp(source, destination, { recursive: true });
  }
}

function deepMerge(base, overlay) {
  if (Array.isArray(base) || Array.isArray(overlay)) {
    return structuredClone(overlay ?? base);
  }
  if (isObject(base) && isObject(overlay)) {
    const result = structuredClone(base);
    for (const [key, value] of Object.entries(overlay)) {
      result[key] = key in result ? deepMerge(result[key], value) : structuredClone(value);
    }
    return result;
  }
  return structuredClone(overlay ?? base);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function generateIcons(iconDirectory) {
  await mkdir(iconDirectory, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const rgba = renderProfilePrismIcon(size);
    await writeFile(path.join(iconDirectory, `icon-${size}.png`), encodePng(size, size, rgba));
  }
}

function renderProfilePrismIcon(size) {
  const scale = 4;
  const highSize = size * scale;
  const high = new Uint8Array(highSize * highSize * 4);
  const layers = [
    { color: [124, 131, 255, 255], points: [[.289, .242], [.438, .164], [.617, .164], [.711, .281], [.883, .344], [.547, .484], [.289, .352]] },
    { color: [101, 105, 232, 255], points: [[.289, .242], [.438, .344], [.438, .719], [.289, .82]] },
    { color: [85, 88, 201, 255], points: [[.438, .344], [.547, .484], [.547, .695], [.438, .766]] },
    { color: [248, 250, 255, 255], points: [[.141, .57], [.516, .43], [.57, .484], [.141, .625]] },
    { color: [156, 163, 255, 255], points: [[.547, .453], [.859, .336], [.859, .391], [.547, .492]] },
    { color: [70, 215, 196, 255], points: [[.547, .5], [.859, .477], [.859, .531], [.547, .539]] },
    { color: [255, 184, 77, 255], points: [[.547, .547], [.859, .625], [.859, .68], [.547, .586]] }
  ];

  for (let y = 0; y < highSize; y += 1) {
    for (let x = 0; x < highSize; x += 1) {
      const u = (x + 0.5) / highSize;
      const v = (y + 0.5) / highSize;
      const offset = (y * highSize + x) * 4;
      if (!insideRoundedUnitRect(u, v, .219)) continue;
      let color = [23, 26, 58, 255];
      for (const layer of layers) {
        if (pointInPolygon(u, v, layer.points)) color = layer.color;
      }
      high.set(color, offset);
    }
  }

  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const highOffset = (((y * scale + sy) * highSize) + x * scale + sx) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            sums[channel] += high[highOffset + channel];
          }
        }
      }
      const offset = (y * size + x) * 4;
      const sampleCount = scale * scale;
      rgba.set(sums.map((sum) => Math.round(sum / sampleCount)), offset);
    }
  }
  return rgba;
}

function insideRoundedUnitRect(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current++) {
    const [xi, yi] = points[current];
    const [xj, yj] = points[previous];
    const crosses = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.from([
      width >>> 24, width >>> 16, width >>> 8, width,
      height >>> 24, height >>> 16, height >>> 8, height,
      8, 6, 0, 0, 0
    ])),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function directorySize(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    total += entry.isDirectory() ? await directorySize(entryPath) : (await stat(entryPath)).size;
  }
  return total;
}
