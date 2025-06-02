import { Pool, Client } from 'pg';
import fs from 'fs';
import path from 'path';

/**
 * Create a test database instance for testing
 */
export async function createTestDatabase(): Promise<Pool> {
  const testDbName = `test_receipt_vault_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Connect to postgres database to create test database
  const adminClient = new Client({
    connectionString: process.env.DATABASE_URL?.replace(/\/[^\/]*$/, '/postgres') || 'postgresql://postgres:postgres@localhost:5432/postgres'
  });
  
  await adminClient.connect();
  await adminClient.query(`CREATE DATABASE "${testDbName}"`);
  await adminClient.end();

  // Create connection pool for test database
  const testDb = new Pool({
    connectionString: process.env.DATABASE_URL?.replace(/\/[^\/]*$/, `/${testDbName}`) || `postgresql://postgres:postgres@localhost:5432/${testDbName}`,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Apply schema to test database
  await applySchema(testDb);
  
  // Add test data fixtures
  await seedTestData(testDb);

  // Store database name for cleanup
  (testDb as any).__testDbName = testDbName;

  return testDb;
}

/**
 * Apply database schema to test database
 */
async function applySchema(db: Pool): Promise<void> {
  const schemaPath = path.join(__dirname, '../../../database/schema.sql');
  
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schema);
  } else {
    // Fallback minimal schema for testing
    await db.query(`
      -- Users table
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TYPE user_role AS ENUM ('individual', 'company_admin', 'company_employee', 'system_admin');
      CREATE TYPE receipt_status AS ENUM ('uploaded', 'processing', 'processed', 'failed');
      CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'auto_approved');
      
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role user_role DEFAULT 'individual',
        company_id UUID,
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE companies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE receipts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        vendor_name VARCHAR(255),
        total_amount NUMERIC(10,2),
        tax_amount NUMERIC(10,2),
        category VARCHAR(100),
        receipt_date DATE,
        status receipt_status DEFAULT 'uploaded',
        image_path VARCHAR(500),
        image_hash VARCHAR(64),
        description TEXT,
        raw_data JSONB,
        encrypted_fields TEXT[],
        encrypted_total_amount TEXT,
        encrypted_tax_amount TEXT,
        encrypted_card_data TEXT,
        encryption_metadata JSONB,
        requires_manual_review BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE receipt_ocr_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
        raw_text TEXT,
        extracted_data JSONB,
        confidence_score NUMERIC(3,2),
        processing_time_ms INTEGER,
        ocr_provider VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        ip_address INET,
        user_agent TEXT,
        old_value JSONB,
        new_value JSONB,
        reason TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        last_used_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE security_alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        alert_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        user_id UUID REFERENCES users(id),
        description TEXT,
        metadata JSONB,
        resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Indexes for performance
      CREATE INDEX idx_receipts_user_id ON receipts(user_id);
      CREATE INDEX idx_receipts_company_id ON receipts(company_id);
      CREATE INDEX idx_receipts_created_at ON receipts(created_at);
      CREATE INDEX idx_receipts_status ON receipts(status);
      CREATE INDEX idx_receipts_image_hash ON receipts(image_hash);
      CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
      CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
      CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

      -- Add foreign key constraint for company_id in users
      ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id);
    `);
  }
}

/**
 * Seed test database with sample data
 */
async function seedTestData(db: Pool): Promise<void> {
  // Create test companies
  await db.query(`
    INSERT INTO companies (id, name, settings) VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'Test Company 1', '{"receiptRetentionYears": 7, "autoApprovalLimit": 100.00}'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Test Company 2', '{"receiptRetentionYears": 10, "autoApprovalLimit": 200.00}')
  `);

  // Create test users
  await db.query(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, company_id) VALUES 
    ('550e8400-e29b-41d4-a716-446655440011', 'test1@example.com', '$2b$10$test.hash.1', 'Test', 'User1', 'individual', NULL),
    ('550e8400-e29b-41d4-a716-446655440012', 'test2@example.com', '$2b$10$test.hash.2', 'Test', 'User2', 'company_admin', '550e8400-e29b-41d4-a716-446655440001'),
    ('550e8400-e29b-41d4-a716-446655440013', 'test3@example.com', '$2b$10$test.hash.3', 'Test', 'User3', 'company_employee', '550e8400-e29b-41d4-a716-446655440001')
  `);

  // Create test receipts
  await db.query(`
    INSERT INTO receipts (id, user_id, company_id, vendor_name, total_amount, tax_amount, category, receipt_date, status) VALUES 
    ('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440011', NULL, 'Test Store 1', 25.99, 2.60, 'office_supplies', '2024-01-15', 'processed'),
    ('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'Test Store 2', 150.00, 15.00, 'travel', '2024-01-16', 'processed'),
    ('550e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', 'Test Store 3', 75.50, 7.55, 'meals', '2024-01-17', 'processing')
  `);

  // Create test OCR data
  await db.query(`
    INSERT INTO receipt_ocr_data (receipt_id, raw_text, extracted_data, confidence_score, processing_time_ms, ocr_provider) VALUES 
    ('550e8400-e29b-41d4-a716-446655440021', 'TEST STORE 1\nTOTAL: $25.99\nTAX: $2.60', '{"vendor": "Test Store 1", "total": 25.99, "tax": 2.60}', 0.95, 1500, 'google-vision'),
    ('550e8400-e29b-41d4-a716-446655440022', 'TEST STORE 2\nTOTAL: $150.00\nTAX: $15.00', '{"vendor": "Test Store 2", "total": 150.00, "tax": 15.00}', 0.98, 1200, 'google-vision')
  `);

  // Record schema migration
  await db.query(`
    INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')
  `);
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(db: Pool): Promise<void> {
  const testDbName = (db as any).__testDbName;
  
  if (testDbName) {
    await db.end();
    
    const adminClient = new Client({
      connectionString: process.env.DATABASE_URL?.replace(/\/[^\/]*$/, '/postgres') || 'postgresql://postgres:postgres@localhost:5432/postgres'
    });
    
    await adminClient.connect();
    
    // Terminate active connections to the test database
    await adminClient.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [testDbName]);
    
    // Drop test database
    await adminClient.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await adminClient.end();
  }
}

/**
 * Get current schema version
 */
export async function getCurrentSchemaVersion(db: Pool): Promise<number> {
  try {
    const result = await db.query(`
      SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      // Extract version number from version string (e.g., "001_initial_schema" -> 1)
      const versionStr = result.rows[0].version;
      const versionMatch = versionStr.match(/^(\d+)/);
      return versionMatch ? parseInt(versionMatch[1]) : 0;
    }
    
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Run database migration
 */
export async function runMigration(db: Pool, direction: 'up' | 'down'): Promise<void> {
  if (direction === 'up') {
    // Simple example migration - add a new column
    await db.query(`
      ALTER TABLE receipts ADD COLUMN IF NOT EXISTS migration_test_column VARCHAR(50)
    `);
    
    await db.query(`
      INSERT INTO schema_migrations (version) VALUES ('002_add_test_column')
      ON CONFLICT (version) DO NOTHING
    `);
  } else {
    // Rollback migration
    await db.query(`
      ALTER TABLE receipts DROP COLUMN IF EXISTS migration_test_column
    `);
    
    await db.query(`
      DELETE FROM schema_migrations WHERE version = '002_add_test_column'
    `);
  }
}

/**
 * Database test helpers
 */
export class TestDatabaseHelpers {
  constructor(private db: Pool) {}

  /**
   * Clear all test data but keep schema
   */
  async clearData(): Promise<void> {
    await this.db.query('TRUNCATE TABLE audit_logs CASCADE');
    await this.db.query('TRUNCATE TABLE receipt_ocr_data CASCADE');
    await this.db.query('TRUNCATE TABLE receipts CASCADE');
    await this.db.query('TRUNCATE TABLE api_keys CASCADE');
    await this.db.query('TRUNCATE TABLE security_alerts CASCADE');
    await this.db.query('TRUNCATE TABLE users CASCADE');
    await this.db.query('TRUNCATE TABLE companies CASCADE');
  }

  /**
   * Create test user
   */
  async createTestUser(userData: Partial<any> = {}): Promise<any> {
    const defaultUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'testuser@example.com',
      password_hash: '$2b$10$test.hash.default',
      first_name: 'Test',
      last_name: 'User',
      role: 'individual',
      ...userData
    };

    const result = await this.db.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, company_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      defaultUser.id,
      defaultUser.email,
      defaultUser.password_hash,
      defaultUser.first_name,
      defaultUser.last_name,
      defaultUser.role,
      defaultUser.company_id || null
    ]);

    return result.rows[0];
  }

  /**
   * Create test receipt
   */
  async createTestReceipt(receiptData: Partial<any> = {}): Promise<any> {
    const defaultReceipt = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '550e8400-e29b-41d4-a716-446655440011',
      vendor_name: 'Test Vendor',
      total_amount: 100.00,
      tax_amount: 10.00,
      category: 'office_supplies',
      receipt_date: '2024-01-15',
      status: 'processed',
      ...receiptData
    };

    const result = await this.db.query(`
      INSERT INTO receipts (id, user_id, company_id, vendor_name, total_amount, tax_amount, category, receipt_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      defaultReceipt.id,
      defaultReceipt.user_id,
      defaultReceipt.company_id || null,
      defaultReceipt.vendor_name,
      defaultReceipt.total_amount,
      defaultReceipt.tax_amount,
      defaultReceipt.category,
      defaultReceipt.receipt_date,
      defaultReceipt.status
    ]);

    return result.rows[0];
  }

  /**
   * Get receipt count for user
   */
  async getReceiptCount(userId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) FROM receipts WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }
}