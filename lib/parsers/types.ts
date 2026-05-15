import { ComponentStatus, Incident, StatusLevel } from '@/types/status';

export interface ParseResult {
  overallStatus: StatusLevel;
  statusDescription: string;
  activeIncidents: Incident[];
  pastIncidents: Incident[];
  scheduledMaintenances: Incident[];
  components: ComponentStatus[];
  fetchedAt: string;
}

export interface StatusParser {
  readonly vendorId: string;
  readonly vendorName: string;
  parse(data: unknown): ParseResult;
  validateInput(data: unknown): boolean;
}
