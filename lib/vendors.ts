export const VENDORS = [
  {
    id: "gitlab",
    name: "GitLab",
    statusUrl: "https://status.gitlab.com/",
    apiUrl: "https://api.status.io/1.0/status/5b36dc6502d06804c08349f7",
    logoUrl: "/logos/gitlab.svg",
    accentColor: "#FC6D26",
    description: "DevOps Platform",
    parser: "status_io"
  },
  {
    id: "mongodb",
    name: "MongoDB Atlas",
    statusUrl: "https://status.mongodb.com/",
    apiUrl: "https://status.mongodb.com/api/v2/summary.json",
    logoUrl: "/logos/mongodb.svg",
    accentColor: "#00ED64",
    description: "Database Cloud"
  },
  {
    id: "sailpoint",
    name: "SailPoint",
    statusUrl: "https://status.sailpoint.com/",
    apiUrl: "https://status.sailpoint.com/api/v2/summary.json",
    logoUrl: "/logos/sailpoint.svg",
    accentColor: "#0033A0",
    description: "Identity Security"
  },
  {
    id: "github",
    name: "GitHub",
    statusUrl: "https://www.githubstatus.com/",
    apiUrl: "https://www.githubstatus.com/api/v2/summary.json",
    logoUrl: "/logos/github.svg",
    accentColor: "#f0f6fc",
    description: "Code Collaboration"
  },
  {
    id: "gcp",
    name: "Google Cloud",
    statusUrl: "https://status.cloud.google.com/",
    apiUrl: "https://status.cloud.google.com/incidents.json",
    logoUrl: "/logos/gcp.svg",
    accentColor: "#4285F4",
    description: "Cloud Platform",
    parser: "gcp"
  },
  {
    id: "auth0",
    name: "Auth0",
    statusUrl: "https://status.auth0.com/",
    apiUrl: "https://status.auth0.com/",
    logoUrl: "/logos/auth0.svg",
    accentColor: "#EB5424",
    description: "Identity Platform",
    parser: "auth0_scrape"
  },
  {
    id: "databricks",
    name: "Azure Databricks",
    statusUrl: "https://status.azuredatabricks.net/",
    apiUrl: "https://api.status.io/1.0/status/5d49ec10226b9e13cb6a422e",
    logoUrl: "/logos/databricks.svg",
    accentColor: "#FF3621",
    description: "Data & AI Platform",
    parser: "status_io"
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    statusUrl: "https://www.cloudflarestatus.com/",
    apiUrl: "https://www.cloudflarestatus.com/api/v2/summary.json",
    logoUrl: "/logos/cloudflare.svg",
    accentColor: "#F38020",
    description: "Network & Security"
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    statusUrl: "https://azure.status.microsoft/en-us/status",
    apiUrl: "https://azure.status.microsoft/en-us/status/feed/",
    logoUrl: "/logos/azure.svg",
    accentColor: "#0078D4",
    description: "Cloud Services",
    parser: "azure_rss"
  },
  {
    id: "snowflake",
    name: "Snowflake",
    statusUrl: "https://status.snowflake.com/",
    apiUrl: "https://status.snowflake.com/api/v2/summary.json",
    logoUrl: "/logos/snowflake.svg",
    accentColor: "#29B5E8",
    description: "Data Cloud"
  },
  {
    id: "cycode",
    name: "Cycode",
    statusUrl: "https://status.cycode.com/",
    apiUrl: "https://statuspal.io/api/v1/status_pages/cycode/status",
    logoUrl: "/logos/cycode.svg",
    accentColor: "#7C3AED",
    description: "AppSec Platform",
    parser: "statuspal"
  },
  {
    id: "coralogix",
    name: "Coralogix",
    statusUrl: "https://status.coralogix.com/",
    apiUrl: "https://status.coralogix.com/api/v2/summary.json",
    logoUrl: "/logos/coralogix.svg",
    accentColor: "#5436d6",
    description: "Observability Platform"
  }
]
