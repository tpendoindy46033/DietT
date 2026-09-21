import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rootDir, deployDir } from "./paths.mjs";
import { runWranglerInteractive, runWranglerBackground, runWranglerCapture } from "./wranglerBin.mjs";

const PROJECT_NAME = "my-ai-diet-manager";
const DATABASE_NAME = "my-ai-diet-manager-db";
const WRANGLER_TOML_PATH = resolve(rootDir, "wrangler.toml");
const SECRET_NAMES = ["OPENAI_API_KEY", "APP_PASSWORD", "SESSION_SECRET"];

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function getAuthenticatedAccount() {
  const result = await runWranglerCapture(["whoami"]);
  const match = result.stdout.match(/associated with the email ['"]([^'"]+)['"]/i);
  if (match) return match[1];
  const accountMatch = result.stdout.match(/account[^\n]*\n[^\n]*\n[│|]\s*([^\s│|]+(?: [^\s│|]+)*)/i);
  if (result.stdout.includes("You are logged in") && accountMatch) return accountMatch[1].trim();
  return null;
}

async function requireAuthenticated() {
  const account = await getAuthenticatedAccount();
  if (!account) {
    fail(
      "Not authenticated with Cloudflare. Run `npm run cf:login` first, approve the browser prompt, then re-run this command."
    );
  }
  return account;
}

async function readWranglerToml() {
  return readFile(WRANGLER_TOML_PATH, "utf8");
}

async function writeDatabaseId(databaseId) {
  const contents = await readWranglerToml();
  const updated = contents.replace(/database_id\s*=\s*".*"/, `database_id   = "${databaseId}"`);
  await writeFile(WRANGLER_TOML_PATH, updated, "utf8");
}

async function getCurrentDatabaseId() {
  const contents = await readWranglerToml();
  const match = contents.match(/database_id\s*=\s*"([^"]*)"/);
  return match ? match[1] : "";
}

function isPlaceholderId(id) {
  return !id || id === "REPLACE_WITH_REAL_DATABASE_ID";
}

async function ensureDatabase() {
  const listResult = await runWranglerCapture(["d1", "list", "--json"]);
  let databases = [];
  try {
    databases = JSON.parse(listResult.stdout);
  } catch {
    databases = [];
  }

  let database = databases.find((db) => db.name === DATABASE_NAME);

  if (!database) {
    console.log(`Creating D1 database "${DATABASE_NAME}"...`);
    const createResult = await runWranglerCapture(["d1", "create", DATABASE_NAME]);
    if (createResult.status !== 0) {
      fail(`Failed to create D1 database:\n${createResult.stderr || createResult.stdout}`);
    }
    const idMatch = createResult.stdout.match(/database_id\s*=\s*"([^"]+)"/) || createResult.stdout.match(/"uuid":\s*"([^"]+)"/);
    if (!idMatch) {
      fail(`Could not determine the new database's id from wrangler output:\n${createResult.stdout}`);
    }
    database = { name: DATABASE_NAME, uuid: idMatch[1] };
  } else {
    console.log(`D1 database "${DATABASE_NAME}" already exists.`);
  }

  const databaseId = database.uuid ?? database.database_id;
  // The database id must be written into wrangler.toml before any other D1
  // command runs, since Wrangler resolves the database from that config.
  await writeDatabaseId(databaseId);
  return databaseId;
}

async function applySchema() {
  const schemaPath = resolve(rootDir, "database", "schema.sql");
  console.log("Applying database/schema.sql to the remote D1 database...");
  const result = await runWranglerCapture(["d1", "execute", DATABASE_NAME, "--remote", `--file=${schemaPath}`]);
  if (result.status !== 0) {
    fail(`Failed to apply schema:\n${result.stderr || result.stdout}`);
  }

  const verify = await runWranglerCapture([
    "d1",
    "execute",
    DATABASE_NAME,
    "--remote",
    "--json",
    "--command",
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('profiles','meals','meal_items','weights','sessions','login_attempts')"
  ]);

  let tableCount = 0;
  try {
    const parsed = JSON.parse(verify.stdout);
    tableCount = parsed[0]?.results?.length ?? 0;
  } catch {
    tableCount = 0;
  }

  if (tableCount !== 6) {
    fail(`Schema verification failed: expected 6 tables, found ${tableCount}. Output:\n${verify.stdout}`);
  }
  console.log("All 6 tables verified in the remote database.");
}

async function ensurePagesProject() {
  const listResult = await runWranglerCapture(["pages", "project", "list", "--json"]);
  let projects = [];
  try {
    projects = JSON.parse(listResult.stdout);
  } catch {
    projects = [];
  }

  if (projects.find((p) => p.name === PROJECT_NAME)) {
    console.log(`Pages project "${PROJECT_NAME}" already exists.`);
    return;
  }

  console.log(`Creating Pages project "${PROJECT_NAME}"...`);
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await runWranglerCapture(["pages", "project", "create", PROJECT_NAME, "--production-branch=main"]);
    if (result.status === 0) return;
    lastError = result.stderr || result.stdout;
    console.warn(`Attempt ${attempt} to create the Pages project failed. Retrying...`);
  }
  fail(`Failed to create the Pages project after 3 attempts:\n${lastError}`);
}

async function runBuild() {
  console.log("Building the project...");
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(process.execPath, [resolve(rootDir, "scripts", "build.mjs")], { stdio: "inherit", cwd: rootDir });
  if (result.status !== 0) {
    fail("Build failed. Fix the errors above and try again.");
  }
}

async function deployToPages() {
  console.log("Deploying to Cloudflare Pages...");
  const result = await runWranglerCapture(["pages", "deploy", deployDir, `--project-name=${PROJECT_NAME}`]);
  console.log(result.stdout);
  if (result.status !== 0) {
    fail(`Deployment failed:\n${result.stderr || result.stdout}`);
  }
  const urlMatch = result.stdout.match(/https:\/\/[a-z0-9.-]+\.pages\.dev/i);
  return urlMatch ? urlMatch[0] : `https://${PROJECT_NAME}.pages.dev`;
}

async function fetchHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    return body.ok ? body.data : null;
  } catch (err) {
    return null;
  }
}

async function printMissingSecrets(baseUrl) {
  console.log(`\nChecking live configuration at ${baseUrl}/api/health ...`);
  const health = await fetchHealth(baseUrl);
  if (!health) {
    console.log("Could not reach /api/health yet. It may take a minute for the deployment to become available.");
    return;
  }

  const missing = [];
  if (!health.database) missing.push("DB (D1 binding not resolving - check wrangler.toml database_id)");
  if (!health.openai) missing.push("OPENAI_API_KEY");
  if (!health.password) missing.push("APP_PASSWORD");
  if (!health.sessionSecret) missing.push("SESSION_SECRET");

  if (missing.length === 0) {
    console.log("All resources are configured. The site is fully live.");
  } else {
    console.log(`Still missing: ${missing.join(", ")}`);
    console.log("Run `npm run cf:secrets` to set the missing secrets (this will also redeploy).");
  }
}

async function cmdLogin() {
  console.log("\nA browser window is about to open so you can sign in to Cloudflare.");
  console.log("Please click \"Allow\" on the consent screen once it appears.\n");
  await runWranglerBackground(["login"]);

  const deadline = Date.now() + 3 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const account = await getAuthenticatedAccount();
    if (account) {
      console.log(`\nSigned in to Cloudflare as: ${account}\n`);
      return;
    }
  }
  fail("Timed out waiting for Cloudflare login. Run `npm run cf:login` again, or run it directly with `node scripts/cloudflare.mjs login`.");
}

async function cmdWhoami() {
  const account = await getAuthenticatedAccount();
  if (account) {
    console.log(`Authenticated as: ${account}`);
  } else {
    console.log("Not authenticated. Run `npm run cf:login`.");
  }
}

async function cmdSetup() {
  await requireAuthenticated();
  await ensureDatabase();
  await applySchema();
  await ensurePagesProject();
  await runBuild();
  const url = await deployToPages();
  console.log(`\nDeployed to: ${url}`);
  await printMissingSecrets(url);
}

async function cmdDeploy() {
  await requireAuthenticated();
  const databaseId = await getCurrentDatabaseId();
  if (isPlaceholderId(databaseId)) {
    fail("wrangler.toml still has a placeholder database_id. Run `npm run cf:setup` first.");
  }
  await runBuild();
  const url = await deployToPages();
  console.log(`\nDeployed to: ${url}`);
  await printMissingSecrets(url);
}

async function cmdSecrets() {
  await requireAuthenticated();
  console.log("\nYou will be prompted to enter each secret value directly into Wrangler.");
  console.log("This script never reads, stores, or transmits the values itself.\n");
  for (const name of SECRET_NAMES) {
    console.log(`Setting ${name}...`);
    await runWranglerInteractive(["pages", "secret", "put", name, `--project-name=${PROJECT_NAME}`]);
  }
  console.log("\nSecrets are bound at deploy time, so redeploying now...");
  await cmdDeploy();
}

async function cmdSchema() {
  await requireAuthenticated();
  const databaseId = await getCurrentDatabaseId();
  if (isPlaceholderId(databaseId)) {
    fail("wrangler.toml still has a placeholder database_id. Run `npm run cf:setup` first.");
  }
  await applySchema();
}

async function cmdStatus() {
  const account = await requireAuthenticated();
  console.log(`Authenticated as: ${account}\n`);

  const listResult = await runWranglerCapture(["pages", "project", "list", "--json"]);
  let projects = [];
  try {
    projects = JSON.parse(listResult.stdout);
  } catch {
    projects = [];
  }
  const project = projects.find((p) => p.name === PROJECT_NAME);
  if (!project) {
    console.log(`Pages project "${PROJECT_NAME}" does not exist yet. Run \`npm run cf:setup\`.`);
    return;
  }

  const url = project.subdomain ? `https://${project.subdomain}` : `https://${PROJECT_NAME}.pages.dev`;
  console.log(`Pages project: ${PROJECT_NAME}`);
  console.log(`Live URL: ${url}`);
  await printMissingSecrets(url);
}

const COMMANDS = {
  login: cmdLogin,
  whoami: cmdWhoami,
  setup: cmdSetup,
  deploy: cmdDeploy,
  secrets: cmdSecrets,
  schema: cmdSchema,
  status: cmdStatus
};

const command = process.argv[2];
const handler = COMMANDS[command];
if (!handler) {
  console.error(`Unknown command "${command}". Expected one of: ${Object.keys(COMMANDS).join(", ")}`);
  process.exit(1);
}

handler().catch((err) => {
  console.error(err.stack ?? err.message);
  process.exit(1);
});
