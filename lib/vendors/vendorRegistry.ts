// lib/vendors/vendorRegistry.ts
import type { VendorConfig } from '@/types/bot';

export const VENDOR_REGISTRY: VendorConfig[] = [
  {
    id: 'github',
    displayName: 'GitHub',
    statusPageUrl: 'https://www.githubstatus.com',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://www.githubstatus.com/api/v2',
  },
  {
    id: 'gitlab',
    displayName: 'GitLab',
    statusPageUrl: 'https://status.gitlab.com',
    apiType: 'statusio',
    apiBaseUrl: 'https://api.status.io/1.0/status/5b36dc6502d06804c08349f7',
  },
  {
    id: 'mongodb',
    displayName: 'MongoDB Atlas',
    statusPageUrl: 'https://status.mongodb.com',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://status.mongodb.com/api/v2',
  },
  {
    id: 'gcp',
    displayName: 'Google Cloud',
    statusPageUrl: 'https://status.cloud.google.com',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://status.cloud.google.com/api/v2',
  },
  {
    id: 'auth0',
    displayName: 'Auth0',
    statusPageUrl: 'https://status.auth0.com',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://status.auth0.com/api/v2',
  },
  {
    id: 'databricks',
    displayName: 'Azure Databricks',
    statusPageUrl: 'https://status.azuredatabricks.net',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://status.azuredatabricks.net/api/v2',
  },
  {
    id: 'cloudflare',
    displayName: 'Cloudflare',
    statusPageUrl: 'https://www.cloudflarestatus.com',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://www.cloudflarestatus.com/api/v2',
  },
  {
    id: 'azure',
    displayName: 'Microsoft Azure',
    statusPageUrl: 'https://azure.status.microsoft.com',
    apiType: 'azure',
    apiBaseUrl: 'https://azure.status.microsoft.com/en-us/status/feed/',
  },
  {
    id: 'snowflake',
    displayName: 'Snowflake',
    statusPageUrl: 'https://status.snowflake.com',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://status.snowflake.com/api/v2',
  },
  {
    id: 'sailpoint',
    displayName: 'SailPoint',
    statusPageUrl: 'https://status.sailpoint.com',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://status.sailpoint.com/api/v2',
  },
  {
    id: 'cycode',
    displayName: 'Cycode',
    statusPageUrl: 'https://status.cycode.io',
    apiType: 'statuspage_v2',
    apiBaseUrl: 'https://status.cycode.io/api/v2',
  },
];

export const VENDOR_BY_ID = new Map<string, VendorConfig>(
  VENDOR_REGISTRY.map((v) => [v.id, v])
);

// Fuzzy name lookup — handles "GitHub", "github", "Git Hub"
export function findVendorByName(query: string): VendorConfig | undefined {
  const normalised = query.toLowerCase().replace(/\s+/g, '');
  return VENDOR_REGISTRY.find(
    (v) =>
      v.id.toLowerCase() === normalised ||
      v.displayName.toLowerCase().replace(/\s+/g, '') === normalised ||
      v.displayName.toLowerCase().includes(normalised) ||
      normalised.includes(v.id.toLowerCase())
  );
}

export const KNOWN_VENDOR_NAMES = VENDOR_REGISTRY.map((v) => v.displayName).join(', ');
