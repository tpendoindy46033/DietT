import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { resolve, extname, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { stripJsComments, stripSqlComments } from "./helpers/stripComments";

const ROOT = resolve(process.cwd());

// This test file scans the codebase for forbidden strings/patterns. It (and the
// build's own deployment verifier, which necessarily contains some of the same
// substrings to check for them) must be excluded from its own scan.
const SELF_EXCLUDED = new Set([resolve(ROOT, "tests/project-guards.test.ts"), resolve(ROOT, "scripts/verify-deployment.mjs")]);

const SCAN_DIRS = ["src", "scripts", "database", "public"];
const ROOT_FILES = ["package.json", "wrangler.toml", "README.md", "CLOUDFLARE_SETUP.md", "vite.config.ts", "vitest.config.ts"];
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js", ".json", ".toml", ".md"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist-frontend" || entry.name === "deploy-folder") {
      continue;
    }
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function collectScannableFiles(): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    const full = resolve(ROOT, dir);
    if (existsSync(full)) walk(full, files);
  }
  for (const file of ROOT_FILES) {
    const full = resolve(ROOT, file);
    if (existsSync(full)) files.push(full);
  }
  return files.filter((f) => !SELF_EXCLUDED.has(f));
}

function readStripped(file: string): string {
  const content = readFileSync(file, "utf8");
  if (!CODE_EXTENSIONS.has(extname(file))) return content;
  if (extname(file) === ".json" || extname(file) === ".toml" || extname(file) === ".md") return content;
  return stripJsComments(content);
}

const ALL_FILES = collectScannableFiles();

describe("only gpt-5-nano is used anywhere in the project", () => {
  test("no other model name or fallback model appears", () => {
    // Allow "gpt-5-nano", "gpt-5-nano-estimate", and the UI's human-readable
    // "GPT-5 Nano" wording (a space instead of a hyphen before "Nano").
    const allowedPattern = /gpt-5[-\s]nano(-estimate)?/gi;
    const anyGptPattern = /gpt-[a-z0-9-]+/gi;
    const offenders: string[] = [];

    for (const file of ALL_FILES) {
      const content = readStripped(file);
      const withAllowedRemoved = content.replace(allowedPattern, "");
      const matches = withAllowedRemoved.match(anyGptPattern) ?? [];
      for (const match of matches) {
        offenders.push(`${relative(ROOT, file)}: "${match}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  test("known fallback/legacy model families never appear", () => {
    const forbidden = ["gpt-4", "gpt-3.5", "davinci", "curie", "babbage", "claude-3", "gemini", "llama"];
    const offenders: string[] = [];

    for (const file of ALL_FILES) {
      const content = readStripped(file).toLowerCase();
      for (const term of forbidden) {
        if (content.includes(term)) offenders.push(`${relative(ROOT, file)}: contains "${term}"`);
      }
    }

    expect(offenders).toEqual([]);
  });

  test("the model is hardcoded server-side and never read from env or configurable via the frontend", () => {
    const openaiFile = resolve(ROOT, "src/worker/openai.ts");
    const content = readFileSync(openaiFile, "utf8");
    expect(content).toMatch(/const OPENAI_MODEL\s*=\s*"gpt-5-nano"/);

    for (const file of ALL_FILES) {
      const content = readStripped(file);
      expect(content).not.toMatch(/env\.OPENAI_MODEL/);
      expect(content).not.toMatch(/process\.env\.OPENAI_MODEL/);
      if (file.endsWith("wrangler.toml")) {
        expect(content).not.toContain("OPENAI_MODEL");
      }
    }
  });
});

describe("no external nutrition or food-database integration exists", () => {
  test("no known food-database service is referenced anywhere", () => {
    const forbidden = [
      "usda",
      "nutritionix",
      "edamam",
      "fatsecret",
      "spoonacular",
      "fooddata central",
      "openfoodfacts",
      "nutrition database",
      "food database api"
    ];
    const offenders: string[] = [];

    for (const file of ALL_FILES) {
      const content = readStripped(file).toLowerCase();
      for (const term of forbidden) {
        if (content.includes(term)) offenders.push(`${relative(ROOT, file)}: contains "${term}"`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("no secrets are committed", () => {
  test("no .env file exists in the repository (only .env.example)", () => {
    expect(existsSync(resolve(ROOT, ".env"))).toBe(false);
  });

  test("no file contains a value shaped like a real OpenAI API key", () => {
    const keyPattern = /sk-[a-zA-Z0-9]{16,}/;
    const offenders: string[] = [];
    for (const file of ALL_FILES) {
      if (readStripped(file).match(keyPattern)) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});

describe("the frontend never talks to OpenAI directly", () => {
  test("no frontend file references the OpenAI API key or endpoint", () => {
    const frontendDir = resolve(ROOT, "src/frontend");
    const offenders: string[] = [];
    for (const file of walk(frontendDir)) {
      const content = readStripped(file);
      if (content.includes("OPENAI_API_KEY") || content.includes("api.openai.com")) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("database schema completeness", () => {
  const schemaPath = resolve(ROOT, "database", "schema.sql");
  const schema = stripSqlComments(readFileSync(schemaPath, "utf8"));

  test("defines all six required tables", () => {
    for (const table of ["profiles", "meals", "meal_items", "weights", "sessions", "login_attempts"]) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, "i"));
    }
  });

  test("uses cascade deletion for child records", () => {
    const cascadeCount = (schema.match(/ON DELETE CASCADE/gi) ?? []).length;
    expect(cascadeCount).toBeGreaterThanOrEqual(2);
  });

  test("has date-based indexes for meals and weights", () => {
    expect(schema).toMatch(/CREATE INDEX.*meal_date/is);
    expect(schema).toMatch(/CREATE INDEX.*recorded_date/is);
  });

  test("is safe to run more than once", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS");
    expect(schema).toContain("INSERT OR IGNORE");
    expect(schema).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
  });
});

describe("build scripts are cross-platform", () => {
  const scriptsDir = resolve(ROOT, "scripts");
  const scriptFiles = walk(scriptsDir).filter((f) => !SELF_EXCLUDED.has(f));

  test("no script shells out to a Unix-only or Windows-only command", () => {
    const forbidden = ["rm -rf", "cp -r ", " sed ", "chmod ", "powershell", "cmd.exe", ".bat'", ".bat\"", "bash -c"];
    const offenders: string[] = [];
    for (const file of scriptFiles) {
      const content = readStripped(file);
      for (const term of forbidden) {
        if (content.includes(term)) offenders.push(`${relative(ROOT, file)}: contains "${term}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no script contains a hardcoded absolute OS-specific path", () => {
    const offenders: string[] = [];
    for (const file of scriptFiles) {
      const content = readStripped(file);
      if (/[A-Za-z]:\\\\/.test(content) || /\/Users\/[a-z]+\//i.test(content) || /\/home\/[a-z]+\//i.test(content)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test("paths are derived from import.meta.url rather than process.cwd() alone", () => {
    const pathsFile = readFileSync(resolve(scriptsDir, "paths.mjs"), "utf8");
    expect(pathsFile).toContain("fileURLToPath(import.meta.url)");
  });
});

describe("package.json declares the required Node engine and cross-platform scripts", () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

  test("targets Node 20.19 or newer", () => {
    expect(pkg.engines?.node).toMatch(/20\.19/);
  });

  test("exposes the required top-level commands", () => {
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
  });

  test("exposes all seven Cloudflare automation commands", () => {
    for (const cmd of ["cf:login", "cf:whoami", "cf:setup", "cf:deploy", "cf:secrets", "cf:schema", "cf:status"]) {
      expect(pkg.scripts[cmd]).toBeDefined();
    }
  });
});
