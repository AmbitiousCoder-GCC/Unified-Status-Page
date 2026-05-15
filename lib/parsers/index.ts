import { StatusParser } from './types';
import { StatuspageParser } from './statuspage';
import { StatusIoParser } from './status-io';
import { GcpParser } from './gcp';
import { AzureRssParser } from './azure-rss';
import { StatuspalParser } from './statuspal';
import { Auth0ScrapeParser } from './auth0-scrape';

export function getParser(vendorId: string, vendorName: string, parserType: string): StatusParser {
  switch (parserType) {
    case 'statuspage':
      return new StatuspageParser(vendorId, vendorName);
    case 'status_io':
      return new StatusIoParser(vendorId, vendorName);
    case 'gcp':
      return new GcpParser(vendorId, vendorName);
    case 'azure_rss':
      return new AzureRssParser(vendorId, vendorName);
    case 'statuspal':
      return new StatuspalParser(vendorId, vendorName);
    case 'auth0_scrape':
      return new Auth0ScrapeParser(vendorId, vendorName);
    default:
      return new StatuspageParser(vendorId, vendorName);
  }
}

export * from './types';
