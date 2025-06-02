-- GDPR Compliance Tables Migration
-- Creates tables for comprehensive GDPR compliance and data protection

-- User Consent Management
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('necessary', 'analytics', 'marketing', 'functional')),
    granted BOOLEAN NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    ip_address INET,
    user_agent TEXT,
    method VARCHAR(20) NOT NULL CHECK (method IN ('explicit', 'implicit')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Data Processing Records
CREATE TABLE IF NOT EXISTS data_processing_records (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    data_type VARCHAR(100) NOT NULL,
    purpose VARCHAR(100) NOT NULL CHECK (purpose IN (
        'receipt_processing', 'user_authentication', 'analytics', 
        'marketing', 'support', 'legal_compliance'
    )),
    legal_basis VARCHAR(50) NOT NULL CHECK (legal_basis IN (
        'consent', 'contract', 'legal_obligation', 
        'vital_interests', 'public_task', 'legitimate_interests'
    )),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    retention_period INTEGER NOT NULL, -- in days
    automated BOOLEAN NOT NULL DEFAULT true,
    third_party_sharing BOOLEAN NOT NULL DEFAULT false,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Data Export Requests (Right to Data Portability)
CREATE TABLE IF NOT EXISTS data_export_requests (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    format VARCHAR(10) NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'csv', 'pdf')),
    file_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Data Deletion Requests (Right to be Forgotten)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    retained_data JSONB, -- List of data types that must be retained for legal reasons
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Legal Holds (Data that must be retained for legal reasons)
CREATE TABLE IF NOT EXISTS legal_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_types TEXT[] NOT NULL,
    reason TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    active BOOLEAN NOT NULL DEFAULT true,
    authority VARCHAR(200), -- Legal authority requiring the hold
    case_reference VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Download Tokens for Secure File Access
CREATE TABLE IF NOT EXISTS download_tokens (
    token VARCHAR(64) PRIMARY KEY,
    file_path TEXT NOT NULL,
    request_id VARCHAR(100) NOT NULL REFERENCES data_export_requests(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    downloads_count INTEGER NOT NULL DEFAULT 0,
    max_downloads INTEGER NOT NULL DEFAULT 1,
    last_accessed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Privacy Settings for Users
CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_processing_consent JSONB NOT NULL DEFAULT '{}',
    marketing_consent BOOLEAN NOT NULL DEFAULT false,
    analytics_consent BOOLEAN NOT NULL DEFAULT false,
    third_party_sharing BOOLEAN NOT NULL DEFAULT false,
    data_retention_preference VARCHAR(50) DEFAULT 'standard', -- 'minimal', 'standard', 'extended'
    communication_preferences JSONB NOT NULL DEFAULT '{}',
    privacy_level VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (privacy_level IN ('minimal', 'standard', 'full')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- GDPR Compliance Audit Log
CREATE TABLE IF NOT EXISTS gdpr_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,
    performed_by UUID REFERENCES users(id), -- Admin or system user
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    compliance_context JSONB -- Additional compliance-related metadata
);

-- Data Breach Incidents (for GDPR breach notification requirements)
CREATE TABLE IF NOT EXISTS data_breach_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(50) UNIQUE NOT NULL,
    discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_users_count INTEGER,
    data_types_affected TEXT[] NOT NULL,
    breach_description TEXT NOT NULL,
    root_cause TEXT,
    mitigation_actions TEXT,
    regulatory_notification_required BOOLEAN NOT NULL DEFAULT false,
    regulatory_notification_sent BOOLEAN NOT NULL DEFAULT false,
    user_notification_required BOOLEAN NOT NULL DEFAULT false,
    user_notification_sent BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'contained', 'resolved', 'closed')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_user_consents_user_type ON user_consents(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consents_timestamp ON user_consents(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_consents_expires ON user_consents(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_processing_user ON data_processing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_data_processing_timestamp ON data_processing_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_data_processing_purpose ON data_processing_records(purpose);
CREATE INDEX IF NOT EXISTS idx_data_processing_retention ON data_processing_records(timestamp, retention_period);

CREATE INDEX IF NOT EXISTS idx_export_requests_user ON data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_export_requests_status ON data_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_export_requests_expires ON data_export_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON data_deletion_requests(status);

CREATE INDEX IF NOT EXISTS idx_legal_holds_user ON legal_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_holds_active ON legal_holds(active);
CREATE INDEX IF NOT EXISTS idx_legal_holds_end_date ON legal_holds(end_date) WHERE end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_download_tokens_expires ON download_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_download_tokens_request ON download_tokens(request_id);

CREATE INDEX IF NOT EXISTS idx_gdpr_audit_user ON gdpr_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_audit_timestamp ON gdpr_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_gdpr_audit_action ON gdpr_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_breach_incidents_severity ON data_breach_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_status ON data_breach_incidents(status);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_discovered ON data_breach_incidents(discovered_at);

-- Update Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_user_consents_updated_at BEFORE UPDATE ON user_consents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_export_requests_updated_at BEFORE UPDATE ON data_export_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_deletion_requests_updated_at BEFORE UPDATE ON data_deletion_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_holds_updated_at BEFORE UPDATE ON legal_holds 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_privacy_settings_updated_at BEFORE UPDATE ON user_privacy_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_breach_incidents_updated_at BEFORE UPDATE ON data_breach_incidents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- GDPR Compliance Views
CREATE OR REPLACE VIEW user_privacy_overview AS
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as account_created,
    ups.privacy_level,
    ups.data_retention_preference,
    COUNT(DISTINCT uc.consent_type) as active_consents,
    COUNT(DISTINCT dpr.id) as processing_activities,
    MAX(der.requested_at) as last_export_request,
    MAX(ddr.requested_at) as last_deletion_request,
    CASE 
        WHEN lh.id IS NOT NULL THEN true 
        ELSE false 
    END as has_legal_hold
FROM users u
LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
LEFT JOIN user_consents uc ON u.id = uc.user_id AND uc.granted = true 
    AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
LEFT JOIN data_processing_records dpr ON u.id = dpr.user_id
LEFT JOIN data_export_requests der ON u.id = der.user_id
LEFT JOIN data_deletion_requests ddr ON u.id = ddr.user_id
LEFT JOIN legal_holds lh ON u.id = lh.user_id AND lh.active = true
GROUP BY u.id, u.email, u.created_at, ups.privacy_level, ups.data_retention_preference, lh.id;

-- Data Retention Policy View
CREATE OR REPLACE VIEW data_retention_status AS
SELECT 
    user_id,
    data_type,
    purpose,
    MIN(timestamp) as oldest_record,
    MAX(timestamp) as newest_record,
    retention_period,
    COUNT(*) as record_count,
    CASE 
        WHEN MIN(timestamp) + INTERVAL '1 day' * MAX(retention_period) < NOW() 
        THEN true 
        ELSE false 
    END as eligible_for_deletion
FROM data_processing_records
GROUP BY user_id, data_type, purpose, retention_period;

-- Consent Compliance View
CREATE OR REPLACE VIEW consent_compliance_status AS
SELECT 
    user_id,
    consent_type,
    granted,
    timestamp as consent_date,
    expires_at,
    CASE 
        WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
        WHEN granted = true THEN 'active'
        ELSE 'withdrawn'
    END as status,
    method,
    version
FROM (
    SELECT DISTINCT ON (user_id, consent_type) 
        user_id, consent_type, granted, timestamp, expires_at, method, version
    FROM user_consents 
    ORDER BY user_id, consent_type, timestamp DESC
) latest_consents;

-- Comments for Documentation
COMMENT ON TABLE user_consents IS 'Stores user consent records for GDPR compliance';
COMMENT ON TABLE data_processing_records IS 'Logs all data processing activities with legal basis';
COMMENT ON TABLE data_export_requests IS 'Handles Right to Data Portability requests';
COMMENT ON TABLE data_deletion_requests IS 'Handles Right to be Forgotten requests';
COMMENT ON TABLE legal_holds IS 'Tracks data that must be retained for legal reasons';
COMMENT ON TABLE gdpr_audit_log IS 'Comprehensive audit trail for GDPR compliance activities';
COMMENT ON TABLE data_breach_incidents IS 'Records data breaches for regulatory reporting';

COMMENT ON VIEW user_privacy_overview IS 'Summary view of each users privacy and GDPR status';
COMMENT ON VIEW data_retention_status IS 'Shows data retention compliance status by user and data type';
COMMENT ON VIEW consent_compliance_status IS 'Current consent status for all users and consent types';