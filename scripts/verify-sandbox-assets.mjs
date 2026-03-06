#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function platformKey() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'win32') return a === 'arm64' ? 'win32-arm64' : 'win32-x64';
  if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (p === 'linux') return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
  return `${p}-${a}`;
}

function normalizePkg(name) {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

const args = process.argv.slice(2);
const explicitPlatform = args.find((a) => a.startsWith('--platform='))?.split('=')[1];
const rootArg = args.find((a) => a.startsWith('--root='))?.split('=')[1];
const root = rootArg ? path.resolve(rootArg) : process.cwd();
const plat = explicitPlatform || platformKey();

const reqPath = path.join(root, 'resources', 'python', 'requirements.txt');
const runtimeRoot = path.join(root, 'resources', 'python', 'runtime', plat);
const wheelsRoot = path.join(root, 'resources', 'python', 'wheels', plat);

if (!fs.existsSync(reqPath)) {
  console.error(`requirements.txt missing: ${reqPath}`);
  process.exit(1);
}

const runtimeExe = process.platform === 'win32'
  ? path.join(runtimeRoot, 'python.exe')
  : path.join(runtimeRoot, 'bin', 'python3');

if (!fs.existsSync(runtimeExe)) {
  console.error(`Bundled runtime executable missing: ${runtimeExe}`);
  process.exit(2);
}

if (!fs.existsSync(wheelsRoot)) {
  console.error(`Wheels directory missing: ${wheelsRoot}`);
  process.exit(3);
}

const requirements = fs.readFileSync(reqPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/[<>=!~]/)[0].trim())
  .map(normalizePkg);

const wheelFiles = fs.readdirSync(wheelsRoot)
  .filter((name) => name.endsWith('.whl'))
  .map((name) => normalizePkg(name));

const missing = requirements.filter((pkg) => !wheelFiles.some((file) => file.startsWith(`${pkg}-`)));
if (missing.length > 0) {
  console.error(`Missing wheels for platform ${plat}: ${missing.join(', ')}`);
  process.exit(4);
}

console.log(`Sandbox assets verified for ${plat}`);
console.log(`runtime: ${runtimeExe}`);
console.log(`wheels: ${wheelsRoot}`);
