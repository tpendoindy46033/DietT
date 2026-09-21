import { readdir, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { deployDir } from "./paths.mjs";

const REQUIRED_FILES = ["index.html", "_worker.js", "manifest.webmanifest", "_headers"];
const REQUIRED_DIRS = ["assets", "icons"];
const FORBIDDEN_EXTENSIONS = new Set([".ts", ".tsx", ".env", ".sql"]);
const FORBIDDEN_NAMES = new Set(["node_modules", "README.md", ".env", "schema.sql", "package.json", "tsconfig.json"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

export async function verifyDeployment() {
  const errors = [];

  for (const file of REQUIRED_FILES) {
    try {
      await stat(resolve(deployDir, file));
    } catch {
      errors.push(`Missing required file: ${file}`);
    }
  }

  for (const dir of REQUIRED_DIRS) {
    try {
      const s = await stat(resolve(deployDir, dir));
      if (!s.isDirectory()) errors.push(`Expected a directory: ${dir}`);
    } catch {
      errors.push(`Missing required directory: ${dir}`);
    }
  }

  const allFiles = await walk(deployDir);
  for (const file of allFiles) {
    const ext = extname(file);
    const base = file.split(/[\\/]/).pop() ?? "";
    if (FORBIDDEN_EXTENSIONS.has(ext) || FORBIDDEN_NAMES.has(base)) {
      errors.push(`Deploy folder must not contain: ${file}`);
    }
  }

  const workerSource = await (await import("node:fs/promises")).readFile(resolve(deployDir, "_worker.js"), "utf8");
  if (/OPENAI_API_KEY\s*=\s*["']/.test(workerSource)) {
    errors.push("_worker.js appears to contain a hardcoded API key value.");
  }

  if (errors.length > 0) {
    throw new Error(`Deployment verification failed:\n${errors.map((e) => ` - ${e}`).join("\n")}`);
  }

  return { fileCount: allFiles.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDeployment()
    .then((result) => console.log(`Deploy folder verified (${result.fileCount} files).`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
