export const DEPENDENCIES: Record<string, string[]> = {
  github: ["fastly", "aws"],
  gitlab: ["fastly", "google-cloud"],
  auth0: ["aws"],
  databricks: ["azure", "aws"],
  snowflake: ["aws", "gcp"],
  cloudflare: [], // root
  mongodb: ["aws", "gcp"],
};
