const fs = require('fs');

const vendorMeta = {
  'github.ts':     { accentColor: '#2dba4e', description: 'Code hosting & CI/CD' },
  'mongodb.ts':    { accentColor: '#00ed64', description: 'Document database' },
  'azure.ts':      { accentColor: '#0078d4', description: 'Microsoft cloud platform' },
  'google-cloud.ts': { accentColor: '#4285f4', description: 'Google cloud services' },
  'aws.ts':        { accentColor: '#ff9900', description: 'Amazon cloud platform' },
  'cloudflare.ts': { accentColor: '#f38020', description: 'CDN & security services' },
  'gitlab.ts':     { accentColor: '#fc6d26', description: 'DevOps & CI/CD platform' },
  'databricks.ts': { accentColor: '#ff3621', description: 'Data & AI platform' },
  'auth0.ts':      { accentColor: '#eb5424', description: 'Identity & auth provider' },
  'snowflake.ts':  { accentColor: '#29b5e8', description: 'Cloud data warehouse' },
  'sailpoint.ts':  { accentColor: '#0033a0', description: 'Identity governance' },
  'cycode.ts':     { accentColor: '#6c5ce7', description: 'Code security platform' },
};

for (const [file, meta] of Object.entries(vendorMeta)) {
  const path = 'lib/vendors/' + file;
  let content = fs.readFileSync(path, 'utf8');
  
  // Add accentColor and description after the name property
  if (!content.includes('accentColor')) {
    content = content.replace(
      /(\s+name:\s*"[^"]+",)/,
      `$1\n    description: "${meta.description}",\n    accentColor: "${meta.accentColor}",`
    );
    fs.writeFileSync(path, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`${file} already has accentColor`);
  }
}
