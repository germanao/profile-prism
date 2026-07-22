import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const execute = promisify(execFile);
const root = process.cwd();
const packageScript = path.join(root, "build", "package.mjs");
const checksumFile = path.join(root, "artifacts", "SHA256SUMS.txt");

async function packageAndReadChecksums() {
  await execute(process.execPath, [packageScript], { cwd: root });
  return readFile(checksumFile, "utf8");
}

const first = await packageAndReadChecksums();
const second = await packageAndReadChecksums();

if (first !== second) {
  throw new Error(
    "Packaging is not reproducible: two builds from the same dist tree produced different SHA-256 checksums."
  );
}

const lines = second.trim().split("\n").filter(Boolean);
if (lines.length !== 5) {
  throw new Error(`Expected four browser artifacts and one source artifact, found ${lines.length}.`);
}

process.stdout.write(
  `Reproducible packaging passed for four browser artifacts and one source artifact.\n`
);
