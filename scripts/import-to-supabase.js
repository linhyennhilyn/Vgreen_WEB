// scripts/import-to-supabase.js
// Usage:
// 1) Install dependency: `npm install @supabase/supabase-js`
// 2) Set env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role key)
// 3) Run: `node scripts/import-to-supabase.js`

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const repoRoot = path.resolve(__dirname, '..');

// Map source JSON files to Supabase table names.
// Adjust table names as needed to match your Supabase schema.
const mappings = [
  { file: 'data/admins.json', table: 'admins' },
  { file: 'data/blogs.json', table: 'blogs' },
  { file: 'data/chat_conversations.json', table: 'chat_conversations' },
  { file: 'data/consultations.json', table: 'consultations' },
  { file: 'data/orders.json', table: 'orders' },
  { file: 'data/products.json', table: 'products' },
  { file: 'data/reviews.json', table: 'reviews' },
  { file: 'data/users.json', table: 'users' },
  { file: 'data/blogs/blogs.json', table: 'blogs' },
  { file: 'data/cookbook/dishes.json', table: 'dishes' },
  { file: 'data/cookbook/instructions.json', table: 'instructions' },
  { file: 'data/promotion/promotion_target.json', table: 'promotion_target' },
  { file: 'data/promotion/promotions.json', table: 'promotions' }
];

function readJson(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) {
    console.warn(`File not found: ${relPath}, skipping.`);
    return null;
  }
  const raw = fs.readFileSync(abs, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse JSON ${relPath}:`, err.message);
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
  // Use upsert to avoid duplicates when running multiple times.
  const { error } = await supabase.from(table).upsert(items, { returning: 'minimal' });
  if (error) {
    console.error(`Supabase upsert error for table ${table}:`, error.message || error);
  } else {
    console.log(`Imported ${items.length} rows into '${table}' successfully.`);
  }
}

async function main() {
  for (const m of mappings) {
    const data = readJson(m.file);
    if (!data) continue;
    await importArray(m.table, data);
  }

  console.log('Import finished. Verify your Supabase tables and indexes.');
}

main().catch((err) => {
  console.error('Import script failed:', err);
  process.exit(1);
});
