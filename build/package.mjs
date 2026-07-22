import { ZipArchive } from "archiver";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const artifacts = path.join(root, "artifacts");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const targets = ["chrome", "edge", "firefox", "safari"];
const sourceDirectories = [
  "brand",
  "build",
  "docs",
  "fixtures",
  "privacy",
  "public",
  "scripts",
  "src",
  "store-assets",
  "store-listing",
  "tests"
];
const sourceFiles = [
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  "IMPLEMENTATION_PLAN.md",
  "README.md",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "tsconfig.json",
  "vitest.config.ts"
];
const fixedDate = new Date("1980-01-01T00:00:00.000Z");

await rm(artifacts, { recursive: true, force: true });
await mkdir(artifacts, { recursive: true });

const checksums = [];
for (const target of targets) {
  const filename = `profile-prism-${target}-${pkg.version}.zip`;
  const outputPath = path.join(artifacts, filename);
  await zipDirectory(path.join(root, "dist", target), outputPath);
  checksums.push(`${await sha256(outputPath)}  ${filename}`);
}

const sourceFilename = `profile-prism-source-${pkg.version}.zip`;
const sourceOutputPath = path.join(artifacts, sourceFilename);
await zipSource(sourceOutputPath);
checksums.push(`${await sha256(sourceOutputPath)}  ${sourceFilename}`);

await writeFile(path.join(artifacts, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`, "utf8");

async function zipDirectory(source, destination) {
  const files = (await listFiles(source)).map((relativePath) => ({
    source: path.join(source, relativePath),
    name: zipPath(relativePath)
  }));
  await zipFiles(files, destination);
}

async function zipSource(destination) {
  const files = sourceFiles.map((relativePath) => ({
    source: path.join(root, relativePath),
    name: zipPath(relativePath)
  }));
  for (const directory of sourceDirectories) {
    for (const relativePath of await listFiles(path.join(root, directory))) {
      files.push({
        source: path.join(root, directory, relativePath),
        name: zipPath(path.join(directory, relativePath))
      });
    }
  }
  files.sort((left, right) => left.name.localeCompare(right.name, "en"));
  await zipFiles(files, destination);
}

async function zipFiles(files, destination) {
  const entries = await Promise.all(
    files.map(async (file) => ({ ...file, contents: await readFile(file.source) }))
  );
  await new Promise((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const file of entries) {
      archive.append(file.contents, {
        name: file.name,
        date: fixedDate,
        mode: 0o644
      });
    }
    archive.finalize();
  });
}

async function listFiles(directory, prefix = "") {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      output.push(...await listFiles(path.join(directory, entry.name), relativePath));
    } else if (entry.isFile()) {
      output.push(relativePath);
    }
  }
  return output;
}

function zipPath(value) {
  return value.split(path.sep).join("/");
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
