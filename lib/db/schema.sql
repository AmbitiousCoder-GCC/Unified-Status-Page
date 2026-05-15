CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT,
  status_url TEXT,
  api_url TEXT,
  logo_url TEXT,
  accent_color TEXT,
  description TEXT,
  parser TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS status_checks (
  id SERIAL PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT,
  response_time_ms INTEGER,
  raw_data JSONB
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  title TEXT,
  severity TEXT,
  status TEXT,
  started_at TIMESTAMP,
  resolved_at TIMESTAMP,
  duration_minutes INTEGER,
  affected_components TEXT[],
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uptime_daily (
  id SERIAL PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  date DATE,
  uptime_pct DECIMAL(5,4),
  total_checks INTEGER,
  failed_checks INTEGER,
  UNIQUE(vendor_id, date)
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  condition_type TEXT,
  threshold_minutes INTEGER,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
