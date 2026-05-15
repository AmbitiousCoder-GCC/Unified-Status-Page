const fs = require('fs');
const files = {
  'github.ts': '00000000-0000-4000-8000-000000000001',
  'mongodb.ts': '00000000-0000-4000-8000-000000000002',
  'azure.ts': '00000000-0000-4000-8000-000000000003',
  'google-cloud.ts': '00000000-0000-4000-8000-000000000004',
  'aws.ts': '00000000-0000-4000-8000-000000000005',
  'cloudflare.ts': '00000000-0000-4000-8000-000000000006',
  'gitlab.ts': '00000000-0000-4000-8000-000000000007',
  'databricks.ts': '00000000-0000-4000-8000-000000000008',
  'auth0.ts': '00000000-0000-4000-8000-000000000009',
  'snowflake.ts': '00000000-0000-4000-8000-000000000010',
  'sailpoint.ts': '00000000-0000-4000-8000-000000000011',
  'cycode.ts': '00000000-0000-4000-8000-000000000012'
};

for (const [file, uuid] of Object.entries(files)) {
  const path = 'lib/vendors/' + file;
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/id:\s*"[a-z0-9-]+"/, `id: "${uuid}"`);
  fs.writeFileSync(path, content);
}
console.log('UUIDs updated.');
