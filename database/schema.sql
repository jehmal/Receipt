-- Forever Receipt Vault Database Schema
-- Supports multi-tenant architecture with compliance-grade audit trails

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
CREATE TYPE user_role AS ENUM ('individual', 'company_admin', 'company_employee', 'system_admin');
CREATE TYPE subscription_tier AS ENUM ('free', 'personal', 'business', 'enterprise');
CREATE TYPE receipt_status AS ENUM ('uploaded', 'processing', 'processed', 'failed');
CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'export', 'share');

-- Users table with authentication and profile data
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role user_role DEFAULT 'individual',
    subscription_tier subscription_tier DEFAULT 'free',
    company_id UUID,
    avatar_url VARCHAR(500),
    locale VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(32),
    email_notifications BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Companies table for multi-tenant support
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    admin_user_id UUID NOT NULL,
    subscription_tier subscription_tier DEFAULT 'business',
    max_users INTEGER DEFAULT 5,
    max_storage_gb INTEGER DEFAULT 100,
    billing_email VARCHAR(255),
    tax_id VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2) DEFAULT 'US',
    settings JSONB DEFAULT '{}',
    retention_policy_days INTEGER DEFAULT 2555, -- 7 years
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (admin_user_id) REFERENCES users(id)
);

-- Add company reference to users
ALTER TABLE users ADD CONSTRAINT fk_users_company 
    FOREIGN KEY (company_id) REFERENCES companies(id);

-- Receipts table with comprehensive metadata
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    company_id UUID,
    original_filename VARCHAR(255),
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    
    -- OCR and processing data
    ocr_text TEXT,
    ocr_confidence FLOAT,
    ocr_language VARCHAR(10),
    status receipt_status DEFAULT 'uploaded',
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    
    -- Extracted metadata
    vendor_name VARCHAR(255),
    vendor_address TEXT,
    vendor_phone VARCHAR(20),
    vendor_email VARCHAR(255),
    
    -- Financial data
    total_amount DECIMAL(10,2),
    subtotal_amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    tip_amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Receipt details
    receipt_date DATE,
    receipt_time TIME,
    receipt_number VARCHAR(100),
    payment_method VARCHAR(50),
    
    -- Categorization
    category VARCHAR(100),
    subcategory VARCHAR(100),
    tags TEXT[],
    description TEXT,
    notes TEXT,
    
    -- Business/project tracking
    project_code VARCHAR(50),
    department VARCHAR(100),
    cost_center VARCHAR(50),
    employee_id VARCHAR(50),
    
    -- Compliance and audit
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    
    -- Search and ML
    embedding_vector FLOAT[],
    similarity_hash VARCHAR(32),
    
    -- Timestamps and metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Receipt items table for line-item detail
CREATE TABLE receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,3) DEFAULT 1,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    category VARCHAR(100),
    sku VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

-- Tags table for flexible categorization
CREATE TABLE receipt_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    tag_value VARCHAR(255),
    confidence_score FLOAT,
    source VARCHAR(50) DEFAULT 'manual', -- manual, ocr, ml
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
    UNIQUE(receipt_id, tag_name)
);

-- Email-to-vault configurations
CREATE TABLE email_inboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    email_address VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    auto_process BOOLEAN DEFAULT TRUE,
    default_category VARCHAR(100),
    default_tags TEXT[],
    allowed_senders TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Audit log for compliance and security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    company_id UUID,
    action audit_action NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- receipt, user, company, etc.
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Sessions table for JWT token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Processing queue for background jobs
CREATE TABLE job_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Companies
CREATE INDEX idx_companies_admin_user_id ON companies(admin_user_id);
CREATE INDEX idx_companies_deleted_at ON companies(deleted_at) WHERE deleted_at IS NULL;

-- Receipts
CREATE INDEX idx_receipts_user_id ON receipts(user_id);
CREATE INDEX idx_receipts_company_id ON receipts(company_id);
CREATE INDEX idx_receipts_file_hash ON receipts(file_hash);
CREATE INDEX idx_receipts_receipt_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_total_amount ON receipts(total_amount);
CREATE INDEX idx_receipts_category ON receipts(category);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);
CREATE INDEX idx_receipts_deleted_at ON receipts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_receipts_ocr_text_gin ON receipts USING gin(to_tsvector('english', ocr_text));
CREATE INDEX idx_receipts_vendor_name_gin ON receipts USING gin(to_tsvector('english', vendor_name));

-- Receipt items
CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id);

-- Receipt tags
CREATE INDEX idx_receipt_tags_receipt_id ON receipt_tags(receipt_id);
CREATE INDEX idx_receipt_tags_tag_name ON receipt_tags(tag_name);

-- Audit logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Job queue
CREATE INDEX idx_job_queue_job_type ON job_queue(job_type);
CREATE INDEX idx_job_queue_scheduled_for ON job_queue(scheduled_for);
CREATE INDEX idx_job_queue_priority ON job_queue(priority DESC);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_inboxes_updated_at BEFORE UPDATE ON email_inboxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for multi-tenancy
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own receipts
CREATE POLICY user_receipts_policy ON receipts
    FOR ALL TO authenticated_users
    USING (user_id = current_user_id());

-- Company admins can see all company receipts
CREATE POLICY company_receipts_policy ON receipts
    FOR ALL TO company_admins
    USING (company_id = current_user_company_id());

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_company_id() 
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_company_id')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create roles for RLS
CREATE ROLE authenticated_users;
CREATE ROLE company_admins;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated_users;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO company_admins;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated_users;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO company_admins;