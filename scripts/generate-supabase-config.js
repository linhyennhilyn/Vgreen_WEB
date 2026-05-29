const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_EMAIL_DOMAIN = process.env.SUPABASE_EMAIL_DOMAIN || 'vgreen.local';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const apps = [
  {
    name: 'my-user',
    directory: path.join(__dirname, '..', 'my-user', 'src', 'app'),
    content: `export const SUPABASE_URL = '${SUPABASE_URL}';\nexport const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';\nexport const SUPABASE_EMAIL_DOMAIN = '${SUPABASE_EMAIL_DOMAIN}';\n`,
  },
  {
    name: 'my-admin',
    directory: path.join(__dirname, '..', 'my-admin', 'src', 'app'),
    content: `export const SUPABASE_URL = '${SUPABASE_URL}';\nexport const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';\n`,
  },
];

for (const app of apps) {
  const destination = path.join(app.directory, 'supabase.config.ts');
  fs.writeFileSync(destination, app.content, 'utf8');
  console.log(`Generated ${destination}`);
}
