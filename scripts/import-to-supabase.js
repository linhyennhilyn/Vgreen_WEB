// scripts/import-to-supabase.js
// Usage:
// 1) Install dependency: `npm install @supabase/supabase-js`
// 2) Set env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role key)
// 3) Run: `node scripts/import-to-supabase.js`

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const rootEnvPath = path.resolve(__dirname, '..', '.env');
const backendEnvPath = path.resolve(__dirname, '..', 'backend', '.env');
const envPath = fs.existsSync(rootEnvPath) ? rootEnvPath : backendEnvPath;

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded environment variables from: ${envPath}`);
} else {
  console.warn('No .env file found in root or backend folder. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY manually.');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const repoRoot = path.resolve(__dirname, '..');
const dataRoot = path.join(repoRoot, 'data');

function findJsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsonFiles(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(entryPath);
    }
  }

  return files;
}

function getTableName(filePath) {
  const relative = path.relative(dataRoot, filePath);
  const parsed = path.parse(relative);
  return parsed.name;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse JSON ${filePath}:`, err.message);
    return null;
  }
}

async function importArray(table, items) {
  if (!Array.isArray(items)) {
    console.warn(`Data for table ${table} is not an array — wrapping into array.`);
    items = [items];
  }

  if (items.length === 0) {
    console.log(`No items for table ${table}, skipping.`);
    return;
  }

  console.log(`Importing ${items.length} rows into table '${table}'`);
  const { error } = await supabase.from(table).upsert(items, { returning: 'minimal' });
  if (error) {
    console.error(`Supabase upsert error for table ${table}:`, error.message || error);
  } else {
    console.log(`Imported ${items.length} rows into '${table}' successfully.`);
  }
}

async function importTreeComplete(data) {
  if (!data) return;

  // Restore legacy behavior: store a single document for tree_complete
  console.log(`Importing tree_complete as a single document (legacy format)`);

  // Unwrap array-wrapped payloads produced by some JSON exports
  if (Array.isArray(data) && data.length === 1) {
    data = data[0];
  }

  // Upsert the entire object as one row. This assumes the Supabase table
  // accepts a JSON-like record (previously used for legacy import).
  try {
    const payload = data;

    // Upsert into a dedicated table that stores a single JSONB document.
    // Table schema expected:
    //   CREATE TABLE tree_complete_doc (id text PRIMARY KEY, tree jsonb);
    const doc = { id: 'tree', tree: payload };
    const { error } = await supabase.from('tree_complete_doc').upsert([doc], { returning: 'minimal' });
    if (error) {
      console.error(`Supabase upsert error for table tree_complete:`, error.message || error);
    } else {
      console.log(`Imported tree_complete as single document successfully.`);
    }
  } catch (err) {
    console.error('Unexpected error importing tree_complete:', err.message || err);
  }
}

async function main() {
  if (!fs.existsSync(dataRoot)) {
    console.error('Data directory not found:', dataRoot);
    process.exit(1);
  }

  const files = findJsonFiles(dataRoot);
  if (files.length === 0) {
    console.log('Không tìm thấy file JSON nào trong thư mục data/.');
    return;
  }

  console.log(`Found ${files.length} JSON file(s) to import.`);
  for (const filePath of files) {
    const table = getTableName(filePath);
    const data = readJson(filePath);
    if (!data) continue;

    if (table === 'tree_complete') {
      await importTreeComplete(data);
      continue;
    }

    await importArray(table, data);
  }

  console.log('Import finished. Verify your Supabase tables and indexes.');
}

main().catch((err) => {
  console.error('Import script failed:', err);
  process.exit(1);
});
