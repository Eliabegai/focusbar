import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const packageJsonPath = path.join(root, "package.json");
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));

if (!packageJson.version) {
  throw new Error("package.json sem campo version.");
}

if (!tauriConf.package) {
  tauriConf.package = {};
}

const version = String(packageJson.version);
tauriConf.package.version = version;

fs.writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, "utf-8");

console.log(`Versão sincronizada: ${version}`);
