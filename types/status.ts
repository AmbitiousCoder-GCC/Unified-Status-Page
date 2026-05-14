export type StatusLevel = 
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "unknown"

export interface Incident {
  id: string
  title: string
  severity: "critical" | "major" | "minor" | "maintenance"
  status: "investigating" | "identified" | "monitoring" | "resolved"
  startedAt: string
  resolvedAt?: string
  affectedComponents: string[]
  updates: IncidentUpdate[]
  url: string
}

export interface IncidentUpdate {
  timestamp: string
  message: string
  status: string
}

export interface DayUptime {
  date: string
  uptimePct: number
}

export interface VendorStatus {
  vendorId: string
  fetchedAt: string
  overallStatus: StatusLevel
  statusDescription: string
  uptimePct15d: number
  uptimeHistory: DayUptime[]
  activeIncidents: Incident[]
  pastIncidents: Incident[]
  scheduledMaintenances: Incident[]
  components: ComponentStatus[]
}

export interface ComponentStatus {
  id: string
  name: string
  status: StatusLevel
  uptimePct: number
}
