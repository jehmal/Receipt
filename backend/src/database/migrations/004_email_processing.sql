-- Migration 004: Email Processing Tables
-- This migration adds tables for email-to-vault functionality

-- Table for storing processed emails
CREATE TABLE IF NOT EXISTS email_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Email identification
    email_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash for deduplication
    message_id VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    email_date TIMESTAMP WITH TIME ZONE NOT NULL,
    body_preview TEXT, -- First 500 chars of email body
    
    -- Processing metadata
    attachment_count INTEGER DEFAULT 0,
    processed_attachments INTEGER DEFAULT 0,
    skipped_attachments INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'processing', -- processing, completed, failed, no_attachments
    processing_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for email processing rules
CREATE TABLE IF NOT EXISTS email_processing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Rule metadata
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    rule_order INTEGER DEFAULT 0, -- For rule priority
    
    -- Matching patterns
    from_email_pattern VARCHAR(255), -- Regex pattern for sender email
    subject_pattern VARCHAR(255),    -- Regex pattern for subject line
    
    -- Auto-assignment rules
    auto_category VARCHAR(100),
    auto_tags TEXT[], -- Array of tags to auto-assign
    requires_approval BOOLEAN,
    default_project VARCHAR(100),
    default_department VARCHAR(100),
    default_cost_center VARCHAR(100),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_patterns CHECK (
        from_email_pattern IS NOT NULL OR subject_pattern IS NOT NULL
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_receipts_user_id ON email_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_receipts_company_id ON email_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_email_receipts_email_hash ON email_receipts(email_hash);
CREATE INDEX IF NOT EXISTS idx_email_receipts_from_email ON email_receipts(from_email);
CREATE INDEX IF NOT EXISTS idx_email_receipts_status ON email_receipts(status);
CREATE INDEX IF NOT EXISTS idx_email_receipts_email_date ON email_receipts(email_date);

CREATE INDEX IF NOT EXISTS idx_email_processing_rules_user_id ON email_processing_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_rules_company_id ON email_processing_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_email_processing_rules_active ON email_processing_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_email_processing_rules_order ON email_processing_rules(rule_order);

-- RLS (Row Level Security) policies
ALTER TABLE email_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_rules ENABLE ROW LEVEL SECURITY;

-- Email receipts policies
CREATE POLICY email_receipts_user_isolation ON email_receipts
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Email processing rules policies  
CREATE POLICY email_processing_rules_user_isolation ON email_processing_rules
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Add helpful comments
COMMENT ON TABLE email_receipts IS 'Stores metadata about processed emails and their attachments';
COMMENT ON TABLE email_processing_rules IS 'User-defined rules for automatically processing email attachments';

COMMENT ON COLUMN email_receipts.email_hash IS 'SHA-256 hash of messageId + from + date for deduplication';
COMMENT ON COLUMN email_receipts.body_preview IS 'First 500 characters of email body for context';
COMMENT ON COLUMN email_processing_rules.from_email_pattern IS 'Regex pattern to match sender email addresses';
COMMENT ON COLUMN email_processing_rules.subject_pattern IS 'Regex pattern to match email subject lines';
COMMENT ON COLUMN email_processing_rules.rule_order IS 'Priority order for rule application (lower = higher priority)';

-- Insert some default processing rules for common scenarios
INSERT INTO email_processing_rules (
    user_id, name, is_active, from_email_pattern, auto_category, auto_tags, rule_order
) VALUES 
-- These will be inserted per user, so using a placeholder UUID for now
-- In practice, this would be done when a user first accesses email processing
-- ('00000000-0000-0000-0000-000000000000', 'Gas Station Receipts', true, '.*(shell|bp|exxon|chevron|mobil).*', 'Transportation', ARRAY['gas', 'fuel'], 1),
-- ('00000000-0000-0000-0000-000000000000', 'Restaurant Receipts', true, '.*(restaurant|cafe|diner|eatery).*', 'Food & Dining', ARRAY['restaurant', 'food'], 2),
-- ('00000000-0000-0000-0000-000000000000', 'Hotel Receipts', true, '.*(hotel|inn|resort|motel).*', 'Business', ARRAY['travel', 'accommodation'], 3),
-- ('00000000-0000-0000-0000-000000000000', 'Office Supplies', true, '.*(office depot|staples|amazon).*', 'Business', ARRAY['office', 'supplies'], 4)

-- Note: Default rules should be created when user first accesses email processing features
ON CONFLICT DO NOTHING;