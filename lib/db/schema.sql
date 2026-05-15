-- Unified Status Page Database Schema
-- Optimized for Vercel Postgres (PostgreSQL)

-- 1. Vendors table: Core registry of monitored services
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    status_page_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Vendor Status table: Real-time status snapshots
CREATE TABLE IF NOT EXISTS vendor_status (
    vendor_id UUID PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('OPERATIONAL', 'DEGRADED', 'OUTAGE')),
    description TEXT,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Incidents table: Historical log of events
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY, -- Using vendor-provided incident IDs if available
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    impact TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 4. Chat Conversations: Sessions for the AI assistant
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT, -- Optional, for future auth integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Chat Messages: Individual messages within a conversation
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Audit Logs: Security and interaction tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_ip TEXT NOT NULL,
    user_message TEXT,
    response TEXT,
    context_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Status Checks: Granular log for uptime calculation
CREATE TABLE IF NOT EXISTS status_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Uptime Daily: Aggregated data for sparklines
CREATE TABLE IF NOT EXISTS uptime_daily (
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_checks INTEGER DEFAULT 0,
    failed_checks INTEGER DEFAULT 0,
    uptime_pct NUMERIC(5,2) DEFAULT 100.00,
    PRIMARY KEY (vendor_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_vendor_id ON incidents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_status_checks_vendor_id ON status_checks(vendor_id);
CREATE INDEX IF NOT EXISTS idx_status_checks_timestamp ON status_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_uptime_daily_vendor_id ON uptime_daily(vendor_id);
CREATE INDEX IF NOT EXISTS idx_uptime_daily_date ON uptime_daily(date);
