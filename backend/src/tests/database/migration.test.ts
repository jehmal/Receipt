import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

describe('Database Migration Testing', () => {
  let testDb: Client;
  let initialDb: Client;

  beforeAll(async () => {
    // Create test database
    initialDb = new Client({
      connectionString: process.env.DATABASE_URL?.replace('/receipt_vault', '/postgres')
    });
    await initialDb.connect();
    
    const testDbName = `test_migration_${Date.now()}`;
    await initialDb.query(`CREATE DATABASE ${testDbName}`);
    
    testDb = new Client({
      connectionString: process.env.DATABASE_URL?.replace('/receipt_vault', `/${testDbName}`)
    });
    await testDb.connect();
  });

  afterAll(async () => {
    const dbName = testDb.database;
    await testDb.end();
    await initialDb.query(`DROP DATABASE ${dbName}`);
    await initialDb.end();
  });

  describe('Schema Migration Up/Down Testing', () => {
    it('should apply initial schema migration successfully', async () => {
      // Read and apply initial schema
      const schemaPath = path.join(__dirname, '../../../database/schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      
      await testDb.query(schemaSQL);

      // Verify core tables exist
      const tables = await testDb.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      const tableNames = tables.rows.map(row => row.table_name);
      
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('companies');
      expect(tableNames).toContain('receipts');
      expect(tableNames).toContain('receipt_ocr_data');
      expect(tableNames).toContain('audit_logs');
      expect(tableNames).toContain('api_keys');
    });

    it('should maintain referential integrity constraints', async () => {
      // Test foreign key constraints are properly created
      const constraints = await testDb.query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name, tc.constraint_name
      `);

      // Verify key foreign key relationships
      const foreignKeys = constraints.rows.map(row => ({
        table: row.table_name,
        column: row.column_name,
        references: `${row.foreign_table_name}.${row.foreign_column_name}`
      }));

      // Check critical relationships
      expect(foreignKeys).toContainEqual({
        table: 'receipts',
        column: 'user_id',
        references: 'users.id'
      });

      expect(foreignKeys).toContainEqual({
        table: 'receipts',
        column: 'company_id',
        references: 'companies.id'
      });

      expect(foreignKeys).toContainEqual({
        table: 'receipt_ocr_data',
        column: 'receipt_id',
        references: 'receipts.id'
      });
    });

    it('should create proper indexes for performance', async () => {
      // Check that performance-critical indexes exist
      const indexes = await testDb.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);

      const indexNames = indexes.rows.map(row => row.indexname);

      // Verify critical indexes exist
      expect(indexNames).toContain('idx_receipts_user_id');
      expect(indexNames).toContain('idx_receipts_company_id');
      expect(indexNames).toContain('idx_receipts_created_at');
      expect(indexNames).toContain('idx_audit_logs_resource_id');
      expect(indexNames).toContain('idx_api_keys_key_hash');
    });

    it('should enforce data type constraints', async () => {
      // Test data type constraints
      const columns = await testDb.query(`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      // Verify critical column types
      const receiptColumns = columns.rows.filter(col => col.table_name === 'receipts');
      
      const totalAmountCol = receiptColumns.find(col => col.column_name === 'total_amount');
      expect(totalAmountCol.data_type).toBe('numeric');
      
      const createdAtCol = receiptColumns.find(col => col.column_name === 'created_at');
      expect(createdAtCol.data_type).toBe('timestamp with time zone');
      expect(createdAtCol.is_nullable).toBe('NO');
      
      const statusCol = receiptColumns.find(col => col.column_name === 'status');
      expect(statusCol.data_type).toBe('USER-DEFINED'); // Enum type
    });

    it('should create enum types correctly', async () => {
      // Check that enum types are created
      const enums = await testDb.query(`
        SELECT 
          t.typname,
          string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) as enum_values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typnamespace = (
          SELECT oid FROM pg_namespace WHERE nspname = 'public'
        )
        GROUP BY t.typname
        ORDER BY t.typname
      `);

      const enumTypes = enums.rows.reduce((acc, row) => {
        acc[row.typname] = row.enum_values.split(',');
        return acc;
      }, {});

      // Verify enum types exist and have correct values
      expect(enumTypes).toHaveProperty('user_role');
      expect(enumTypes.user_role).toContain('individual');
      expect(enumTypes.user_role).toContain('company_admin');
      expect(enumTypes.user_role).toContain('company_employee');

      expect(enumTypes).toHaveProperty('receipt_status');
      expect(enumTypes.receipt_status).toContain('uploaded');
      expect(enumTypes.receipt_status).toContain('processing');
      expect(enumTypes.receipt_status).toContain('processed');
      expect(enumTypes.receipt_status).toContain('failed');
    });
  });

  describe('Data Integrity During Migration', () => {
    it('should preserve data during schema changes', async () => {
      // Insert test data
      await testDb.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, role)
        VALUES ('test-user-1', 'test@example.com', 'hashed_password', 'Test', 'User', 'individual')
      `);

      await testDb.query(`
        INSERT INTO receipts (id, user_id, total_amount, vendor_name, status, created_at)
        VALUES ('test-receipt-1', 'test-user-1', 123.45, 'Test Vendor', 'processed', NOW())
      `);

      // Verify data exists
      const beforeMigration = await testDb.query('SELECT COUNT(*) FROM receipts');
      expect(parseInt(beforeMigration.rows[0].count)).toBe(1);

      // Simulate a migration that adds a column
      await testDb.query('ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2)');

      // Verify data still exists and is intact
      const afterMigration = await testDb.query(`
        SELECT id, user_id, total_amount, vendor_name, status, tax_amount
        FROM receipts 
        WHERE id = 'test-receipt-1'
      `);

      expect(afterMigration.rows).toHaveLength(1);
      expect(afterMigration.rows[0].id).toBe('test-receipt-1');
      expect(parseFloat(afterMigration.rows[0].total_amount)).toBe(123.45);
      expect(afterMigration.rows[0].vendor_name).toBe('Test Vendor');
      expect(afterMigration.rows[0].tax_amount).toBeNull(); // New column should be null
    });

    it('should handle migration rollback safely', async () => {
      // Add test data
      await testDb.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, role)
        VALUES ('rollback-user-1', 'rollback@example.com', 'hashed_password', 'Rollback', 'User', 'individual')
      `);

      // Start transaction for migration
      await testDb.query('BEGIN');

      try {
        // Simulate migration that adds a new table
        await testDb.query(`
          CREATE TABLE receipt_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);

        // Add foreign key to existing table
        await testDb.query('ALTER TABLE receipts ADD COLUMN category_id UUID REFERENCES receipt_categories(id)');

        // Simulate migration failure
        throw new Error('Migration failed');

      } catch (error) {
        // Rollback migration
        await testDb.query('ROLLBACK');
      }

      // Verify rollback was successful
      const tableExists = await testDb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'receipt_categories'
        )
      `);
      expect(tableExists.rows[0].exists).toBe(false);

      // Verify original data is still intact
      const userData = await testDb.query(`
        SELECT id, email FROM users WHERE id = 'rollback-user-1'
      `);
      expect(userData.rows).toHaveLength(1);
      expect(userData.rows[0].email).toBe('rollback@example.com');

      // Verify receipts table structure is unchanged
      const receiptColumns = await testDb.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'receipts' AND column_name = 'category_id'
      `);
      expect(receiptColumns.rows).toHaveLength(0);
    });

    it('should validate constraint violations during migration', async () => {
      // Add test data that would violate a new constraint
      await testDb.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, role)
        VALUES ('constraint-user-1', 'constraint@example.com', 'hashed_password', 'Constraint', 'User', 'individual')
      `);

      await testDb.query(`
        INSERT INTO receipts (id, user_id, total_amount, vendor_name, status, created_at)
        VALUES ('constraint-receipt-1', 'constraint-user-1', -50.00, 'Negative Amount', 'processed', NOW())
      `);

      // Try to add constraint that would be violated by existing data
      await expect(
        testDb.query('ALTER TABLE receipts ADD CONSTRAINT chk_positive_amount CHECK (total_amount > 0)')
      ).rejects.toThrow();

      // Verify table structure remains unchanged
      const constraints = await testDb.query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'receipts' AND constraint_name = 'chk_positive_amount'
      `);
      expect(constraints.rows).toHaveLength(0);

      // Verify data is still accessible
      const receiptData = await testDb.query(`
        SELECT total_amount FROM receipts WHERE id = 'constraint-receipt-1'
      `);
      expect(parseFloat(receiptData.rows[0].total_amount)).toBe(-50.00);
    });
  });

  describe('Performance Impact of Migrations', () => {
    it('should complete migrations within acceptable time limits', async () => {
      // Create test data
      const insertPromises = [];
      for (let i = 0; i < 1000; i++) {
        insertPromises.push(
          testDb.query(`
            INSERT INTO users (id, email, password_hash, first_name, last_name, role)
            VALUES ($1, $2, 'hashed_password', 'User', $3, 'individual')
          `, [`perf-user-${i}`, `user${i}@example.com`, `${i}`])
        );
      }
      await Promise.all(insertPromises);

      // Measure migration time
      const startTime = Date.now();
      
      await testDb.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE');
      await testDb.query('CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login)');
      
      const endTime = Date.now();
      const migrationTime = endTime - startTime;

      // Migration should complete within 30 seconds for 1000 records
      expect(migrationTime).toBeLessThan(30000);

      // Verify migration was successful
      const columnExists = await testDb.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_login'
      `);
      expect(columnExists.rows).toHaveLength(1);

      const indexExists = await testDb.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'users' AND indexname = 'idx_users_last_login'
      `);
      expect(indexExists.rows).toHaveLength(1);
    });

    it('should not significantly impact query performance during migration', async () => {
      // Measure baseline query performance
      const baselineStart = Date.now();
      await testDb.query('SELECT COUNT(*) FROM users');
      const baselineTime = Date.now() - baselineStart;

      // Perform migration in background (simulate)
      const migrationPromise = testDb.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_domain 
        ON users(SPLIT_PART(email, '@', 2))
      `);

      // Measure query performance during migration
      const duringStart = Date.now();
      await testDb.query('SELECT COUNT(*) FROM users WHERE role = \'individual\'');
      const duringTime = Date.now() - duringStart;

      await migrationPromise;

      // Query performance shouldn't degrade significantly (within 2x baseline)
      expect(duringTime).toBeLessThan(baselineTime * 2 + 1000); // Add 1s buffer
    });
  });

  describe('Migration Version Control', () => {
    it('should track migration version correctly', async () => {
      // Create migration version table
      await testDb.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Record migration
      const migrationVersion = '001_initial_schema';
      await testDb.query(`
        INSERT INTO schema_migrations (version) VALUES ($1)
      `, [migrationVersion]);

      // Verify version tracking
      const migrations = await testDb.query(`
        SELECT version, applied_at FROM schema_migrations ORDER BY applied_at
      `);

      expect(migrations.rows).toHaveLength(1);
      expect(migrations.rows[0].version).toBe(migrationVersion);
      expect(migrations.rows[0].applied_at).toBeDefined();
    });

    it('should prevent duplicate migration application', async () => {
      const migrationVersion = '002_add_receipts_index';
      
      // Apply migration first time
      await testDb.query(`
        INSERT INTO schema_migrations (version) VALUES ($1)
      `, [migrationVersion]);

      // Attempt to apply same migration again
      await expect(
        testDb.query(`
          INSERT INTO schema_migrations (version) VALUES ($1)
        `, [migrationVersion])
      ).rejects.toThrow(); // Should fail due to primary key constraint

      // Verify only one record exists
      const migrationCount = await testDb.query(`
        SELECT COUNT(*) FROM schema_migrations WHERE version = $1
      `, [migrationVersion]);
      expect(parseInt(migrationCount.rows[0].count)).toBe(1);
    });
  });

  describe('Data Recovery and Backup Testing', () => {
    it('should validate backup creation during migration', async () => {
      // Create test data
      await testDb.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, role)
        VALUES ('backup-user-1', 'backup@example.com', 'hashed_password', 'Backup', 'User', 'individual')
      `);

      // Simulate backup creation (in real scenario, this would be pg_dump)
      const backupData = await testDb.query(`
        SELECT * FROM users WHERE id = 'backup-user-1'
      `);

      expect(backupData.rows).toHaveLength(1);
      expect(backupData.rows[0].email).toBe('backup@example.com');

      // Simulate data loss
      await testDb.query(`DELETE FROM users WHERE id = 'backup-user-1'`);

      // Verify data is gone
      const deletedCheck = await testDb.query(`
        SELECT * FROM users WHERE id = 'backup-user-1'
      `);
      expect(deletedCheck.rows).toHaveLength(0);

      // Simulate restore from backup
      await testDb.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        backupData.rows[0].id,
        backupData.rows[0].email,
        backupData.rows[0].password_hash,
        backupData.rows[0].first_name,
        backupData.rows[0].last_name,
        backupData.rows[0].role
      ]);

      // Verify restore was successful
      const restoredData = await testDb.query(`
        SELECT * FROM users WHERE id = 'backup-user-1'
      `);
      expect(restoredData.rows).toHaveLength(1);
      expect(restoredData.rows[0].email).toBe('backup@example.com');
    });
  });
});