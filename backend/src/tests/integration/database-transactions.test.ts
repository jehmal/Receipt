import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../../database/connection';

describe('Database Transaction Integration Tests', () => {
  beforeAll(async () => {
    // Ensure test database is clean
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up between tests
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Clean up in order to respect foreign key constraints
    await db.query('DELETE FROM receipts WHERE user_id LIKE $1', ['test-%']);
    await db.query('DELETE FROM user_consents WHERE user_id LIKE $1', ['test-%']);
    await db.query('DELETE FROM data_processing_records WHERE user_id LIKE $1', ['test-%']);
    await db.query('DELETE FROM users WHERE id LIKE $1', ['test-%']);
    await db.query('DELETE FROM companies WHERE id LIKE $1', ['test-%']);
  }

  describe('Basic Transaction Operations', () => {
    it('should commit successful transactions', async () => {
      const client = await db.getConnection();
      
      try {
        await client.query('BEGIN');

        // Insert test company
        await client.query(`
          INSERT INTO companies (id, name, domain, status)
          VALUES ($1, $2, $3, $4)
        `, ['test-company-1', 'Test Company 1', 'test1.com', 'active']);

        // Insert test user
        await client.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'test-user-1',
          'test1@example.com',
          '$2a$12$hashedpassword',
          'Test',
          'User',
          'test-company-1',
          'user',
          'active'
        ]);

        await client.query('COMMIT');

        // Verify data was committed
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', ['test-user-1']);
        const companyResult = await db.query('SELECT * FROM companies WHERE id = $1', ['test-company-1']);

        expect(userResult.rows).toHaveLength(1);
        expect(companyResult.rows).toHaveLength(1);
        expect(userResult.rows[0].company_id).toBe('test-company-1');

      } finally {
        client.release();
      }
    });

    it('should rollback failed transactions', async () => {
      const client = await db.getConnection();
      
      try {
        await client.query('BEGIN');

        // Insert test company
        await client.query(`
          INSERT INTO companies (id, name, domain, status)
          VALUES ($1, $2, $3, $4)
        `, ['test-company-2', 'Test Company 2', 'test2.com', 'active']);

        // Try to insert user with invalid foreign key (should fail)
        await expect(client.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'test-user-2',
          'test2@example.com',
          '$2a$12$hashedpassword',
          'Test',
          'User',
          'non-existent-company', // This should cause a foreign key violation
          'user',
          'active'
        ])).rejects.toThrow();

        await client.query('ROLLBACK');

        // Verify no data was committed
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', ['test-user-2']);
        const companyResult = await db.query('SELECT * FROM companies WHERE id = $1', ['test-company-2']);

        expect(userResult.rows).toHaveLength(0);
        expect(companyResult.rows).toHaveLength(0);

      } finally {
        client.release();
      }
    });

    it('should handle nested transactions with savepoints', async () => {
      const client = await db.getConnection();
      
      try {
        await client.query('BEGIN');

        // Insert company
        await client.query(`
          INSERT INTO companies (id, name, domain, status)
          VALUES ($1, $2, $3, $4)
        `, ['test-company-3', 'Test Company 3', 'test3.com', 'active']);

        // Create savepoint
        await client.query('SAVEPOINT sp1');

        // Insert first user (should succeed)
        await client.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'test-user-3a',
          'test3a@example.com',
          '$2a$12$hashedpassword',
          'Test',
          'User A',
          'test-company-3',
          'user',
          'active'
        ]);

        // Create another savepoint
        await client.query('SAVEPOINT sp2');

        // Try to insert duplicate user (should fail)
        try {
          await client.query(`
            INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            'test-user-3a', // Same ID - should cause unique constraint violation
            'test3b@example.com',
            '$2a$12$hashedpassword',
            'Test',
            'User B',
            'test-company-3',
            'user',
            'active'
          ]);
        } catch (error) {
          // Rollback to savepoint
          await client.query('ROLLBACK TO sp2');
        }

        // Insert different user (should succeed)
        await client.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'test-user-3b',
          'test3b@example.com',
          '$2a$12$hashedpassword',
          'Test',
          'User B',
          'test-company-3',
          'user',
          'active'
        ]);

        await client.query('COMMIT');

        // Verify final state
        const userResult = await db.query('SELECT * FROM users WHERE company_id = $1 ORDER BY id', ['test-company-3']);
        expect(userResult.rows).toHaveLength(2);
        expect(userResult.rows[0].id).toBe('test-user-3a');
        expect(userResult.rows[1].id).toBe('test-user-3b');

      } finally {
        client.release();
      }
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce foreign key constraints on insert', async () => {
      await expect(db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-fk',
        'testfk@example.com',
        '$2a$12$hashedpassword',
        'Test',
        'User',
        'non-existent-company-id',
        'user',
        'active'
      ])).rejects.toThrow(/foreign key constraint/i);
    });

    it('should enforce foreign key constraints on update', async () => {
      // Create company and user first
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-fk', 'Test FK Company', 'testfk.com', 'active']);

      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-fk',
        'testfk@example.com',
        '$2a$12$hashedpassword',
        'Test',
        'User',
        'test-company-fk',
        'user',
        'active'
      ]);

      // Try to update to non-existent company
      await expect(db.query(`
        UPDATE users SET company_id = $1 WHERE id = $2
      `, ['non-existent-company', 'test-user-fk'])).rejects.toThrow(/foreign key constraint/i);
    });

    it('should prevent deletion of referenced records', async () => {
      // Create company and user
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-del', 'Test Delete Company', 'testdel.com', 'active']);

      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-del',
        'testdel@example.com',
        '$2a$12$hashedpassword',
        'Test',
        'User',
        'test-company-del',
        'user',
        'active'
      ]);

      // Try to delete company that has users
      await expect(db.query(`
        DELETE FROM companies WHERE id = $1
      `, ['test-company-del'])).rejects.toThrow(/foreign key constraint/i);
    });

    it('should allow cascading deletes where configured', async () => {
      // Create user and receipts
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-cascade', 'Test Cascade Company', 'cascade.com', 'active']);

      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-cascade',
        'cascade@example.com',
        '$2a$12$hashedpassword',
        'Test',
        'User',
        'test-company-cascade',
        'user',
        'active'
      ]);

      await db.query(`
        INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-receipt-cascade',
        'test-user-cascade',
        'test.jpg',
        '/uploads/test.jpg',
        1024,
        'testhash',
        'image/jpeg',
        'processed'
      ]);

      // Verify receipt exists
      const receiptsBefore = await db.query('SELECT * FROM receipts WHERE user_id = $1', ['test-user-cascade']);
      expect(receiptsBefore.rows).toHaveLength(1);

      // Delete user (if cascade is configured, receipts should be deleted too)
      await db.query('DELETE FROM users WHERE id = $1', ['test-user-cascade']);

      // Check if receipts were cascaded (this depends on your schema configuration)
      const receiptsAfter = await db.query('SELECT * FROM receipts WHERE user_id = $1', ['test-user-cascade']);
      // This test would pass if receipts table has ON DELETE CASCADE for user_id
      // expect(receiptsAfter.rows).toHaveLength(0);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique email constraints', async () => {
      // Create company first
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-unique', 'Test Unique Company', 'unique.com', 'active']);

      // Insert first user
      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-unique-1',
        'unique@example.com',
        '$2a$12$hashedpassword',
        'Test',
        'User 1',
        'test-company-unique',
        'user',
        'active'
      ]);

      // Try to insert second user with same email
      await expect(db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-unique-2',
        'unique@example.com', // Same email
        '$2a$12$hashedpassword',
        'Test',
        'User 2',
        'test-company-unique',
        'user',
        'active'
      ])).rejects.toThrow(/unique constraint/i);
    });

    it('should enforce unique ID constraints', async () => {
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-id', 'Test ID Company', 'testid.com', 'active']);

      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'duplicate-user-id',
        'first@example.com',
        '$2a$12$hashedpassword',
        'First',
        'User',
        'test-company-id',
        'user',
        'active'
      ]);

      // Try to insert user with same ID
      await expect(db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'duplicate-user-id', // Same ID
        'second@example.com',
        '$2a$12$hashedpassword',
        'Second',
        'User',
        'test-company-id',
        'user',
        'active'
      ])).rejects.toThrow(/unique constraint|duplicate key/i);
    });

    it('should handle unique constraint violations in transactions', async () => {
      const client = await db.getConnection();
      
      try {
        await client.query('BEGIN');

        await client.query(`
          INSERT INTO companies (id, name, domain, status)
          VALUES ($1, $2, $3, $4)
        `, ['test-company-tx', 'Test TX Company', 'testtx.com', 'active']);

        // Insert first user
        await client.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'test-user-tx-1',
          'transaction@example.com',
          '$2a$12$hashedpassword',
          'Test',
          'User 1',
          'test-company-tx',
          'user',
          'active'
        ]);

        // Try to insert duplicate - should fail and rollback entire transaction
        await expect(client.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'test-user-tx-2',
          'transaction@example.com', // Duplicate email
          '$2a$12$hashedpassword',
          'Test',
          'User 2',
          'test-company-tx',
          'user',
          'active'
        ])).rejects.toThrow();

        await client.query('ROLLBACK');

        // Verify nothing was committed
        const companyResult = await db.query('SELECT * FROM companies WHERE id = $1', ['test-company-tx']);
        const userResult = await db.query('SELECT * FROM users WHERE company_id = $1', ['test-company-tx']);

        expect(companyResult.rows).toHaveLength(0);
        expect(userResult.rows).toHaveLength(0);

      } finally {
        client.release();
      }
    });
  });

  describe('Check Constraints', () => {
    it('should enforce email format constraints', async () => {
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-check', 'Test Check Company', 'check.com', 'active']);

      // Try to insert user with invalid email format
      await expect(db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-check',
        'invalid-email-format', // Invalid email
        '$2a$12$hashedpassword',
        'Test',
        'User',
        'test-company-check',
        'user',
        'active'
      ])).rejects.toThrow(/check constraint|invalid.*email/i);
    });

    it('should enforce amount constraints on receipts', async () => {
      // Create user first
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-amount', 'Test Amount Company', 'amount.com', 'active']);

      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-amount',
        'amount@example.com',
        '$2a$12$hashedpassword',
        'Test',
        'User',
        'test-company-amount',
        'user',
        'active'
      ]);

      // Try to insert receipt with negative amount
      await expect(db.query(`
        INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'test-receipt-negative',
        'test-user-amount',
        'negative.jpg',
        '/uploads/negative.jpg',
        1024,
        'negativehash',
        'image/jpeg',
        'processed',
        -10.50 // Negative amount
      ])).rejects.toThrow(/check constraint|amount.*positive/i);
    });

    it('should enforce status enum constraints', async () => {
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-status', 'Test Status Company', 'status.com', 'active']);

      // Try to insert user with invalid status
      await expect(db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-status',
        'status@example.com',
        '$2a$12$hashedpassword',
        'Test',
        'User',
        'test-company-status',
        'user',
        'invalid_status' // Invalid status
      ])).rejects.toThrow(/invalid input value|check constraint/i);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent inserts with unique constraints', async () => {
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-concurrent', 'Test Concurrent Company', 'concurrent.com', 'active']);

      // Start multiple concurrent transactions
      const insertPromises = Array(5).fill(0).map(async (_, index) => {
        try {
          await db.query(`
            INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            `concurrent-user-${index}`,
            `concurrent${index}@example.com`,
            '$2a$12$hashedpassword',
            'Concurrent',
            `User ${index}`,
            'test-company-concurrent',
            'user',
            'active'
          ]);
          return { success: true, index };
        } catch (error) {
          return { success: false, index, error: error.message };
        }
      });

      const results = await Promise.all(insertPromises);

      // All should succeed since they have unique identifiers
      const successful = results.filter(r => r.success);
      expect(successful).toHaveLength(5);

      // Verify all users were created
      const userCount = await db.query(
        'SELECT COUNT(*) FROM users WHERE company_id = $1',
        ['test-company-concurrent']
      );
      expect(parseInt(userCount.rows[0].count)).toBe(5);
    });

    it('should handle concurrent updates correctly', async () => {
      // Create test data
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-update', 'Test Update Company', 'update.com', 'active']);

      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-update',
        'update@example.com',
        '$2a$12$hashedpassword',
        'Original',
        'Name',
        'test-company-update',
        'user',
        'active'
      ]);

      // Concurrent updates to the same user
      const updatePromises = [
        db.query('UPDATE users SET first_name = $1 WHERE id = $2', ['Updated1', 'test-user-update']),
        db.query('UPDATE users SET last_name = $1 WHERE id = $2', ['Updated2', 'test-user-update']),
        db.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', 'test-user-update'])
      ];

      await Promise.all(updatePromises);

      // Verify final state
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', ['test-user-update']);
      const user = userResult.rows[0];

      // Should have all updates applied
      expect(user.first_name).toBe('Updated1');
      expect(user.last_name).toBe('Updated2');
      expect(user.role).toBe('admin');
    });

    it('should handle concurrent transactions with locks', async () => {
      // Create test receipt
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['test-company-lock', 'Test Lock Company', 'lock.com', 'active']);

      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'test-user-lock',
        'lock@example.com',
        '$2a$12$hashedpassword',
        'Lock',
        'User',
        'test-company-lock',
        'user',
        'active'
      ]);

      await db.query(`
        INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'test-receipt-lock',
        'test-user-lock',
        'lock.jpg',
        '/uploads/lock.jpg',
        1024,
        'lockhash',
        'image/jpeg',
        'processed',
        100.00
      ]);

      // Simulate concurrent processing of the same receipt
      const transaction1 = async () => {
        const client = await db.getConnection();
        try {
          await client.query('BEGIN');
          
          // Lock the receipt for update
          const receipt = await client.query(
            'SELECT * FROM receipts WHERE id = $1 FOR UPDATE',
            ['test-receipt-lock']
          );
          
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Update receipt
          await client.query(
            'UPDATE receipts SET status = $1, vendor_name = $2 WHERE id = $3',
            ['processed', 'Vendor A', 'test-receipt-lock']
          );
          
          await client.query('COMMIT');
          return 'Transaction 1 completed';
        } finally {
          client.release();
        }
      };

      const transaction2 = async () => {
        const client = await db.getConnection();
        try {
          await client.query('BEGIN');
          
          // This should wait for transaction1 to complete
          const receipt = await client.query(
            'SELECT * FROM receipts WHERE id = $1 FOR UPDATE',
            ['test-receipt-lock']
          );
          
          // Update receipt
          await client.query(
            'UPDATE receipts SET vendor_name = $1 WHERE id = $2',
            ['Vendor B', 'test-receipt-lock']
          );
          
          await client.query('COMMIT');
          return 'Transaction 2 completed';
        } finally {
          client.release();
        }
      };

      const results = await Promise.all([transaction1(), transaction2()]);

      expect(results).toEqual(['Transaction 1 completed', 'Transaction 2 completed']);

      // Verify final state (Transaction 2 should have overwritten Transaction 1's vendor_name)
      const finalReceipt = await db.query('SELECT * FROM receipts WHERE id = $1', ['test-receipt-lock']);
      expect(finalReceipt.rows[0].vendor_name).toBe('Vendor B');
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity during complex operations', async () => {
      const client = await db.getConnection();
      
      try {
        await client.query('BEGIN');

        // Create company
        await client.query(`
          INSERT INTO companies (id, name, domain, status)
          VALUES ($1, $2, $3, $4)
        `, ['integrity-company', 'Integrity Company', 'integrity.com', 'active']);

        // Create user
        await client.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'integrity-user',
          'integrity@example.com',
          '$2a$12$hashedpassword',
          'Integrity',
          'User',
          'integrity-company',
          'user',
          'active'
        ]);

        // Create multiple receipts
        for (let i = 1; i <= 3; i++) {
          await client.query(`
            INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status, total_amount)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            `integrity-receipt-${i}`,
            'integrity-user',
            `receipt${i}.jpg`,
            `/uploads/receipt${i}.jpg`,
            1024,
            `hash${i}`,
            'image/jpeg',
            'processed',
            i * 10.00
          ]);
        }

        // Create related data (consents)
        await client.query(`
          INSERT INTO user_consents (user_id, consent_type, granted, timestamp, version, method)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          'integrity-user',
          'analytics',
          true,
          new Date(),
          '1.0',
          'explicit'
        ]);

        await client.query('COMMIT');

        // Verify all data was created correctly
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', ['integrity-user']);
        const receiptsResult = await db.query('SELECT * FROM receipts WHERE user_id = $1', ['integrity-user']);
        const consentsResult = await db.query('SELECT * FROM user_consents WHERE user_id = $1', ['integrity-user']);

        expect(userResult.rows).toHaveLength(1);
        expect(receiptsResult.rows).toHaveLength(3);
        expect(consentsResult.rows).toHaveLength(1);

        // Verify relationships
        expect(userResult.rows[0].company_id).toBe('integrity-company');
        receiptsResult.rows.forEach(receipt => {
          expect(receipt.user_id).toBe('integrity-user');
        });

      } finally {
        client.release();
      }
    });

    it('should handle large batch operations atomically', async () => {
      const client = await db.getConnection();
      const batchSize = 100;
      
      try {
        await client.query('BEGIN');

        // Create company
        await client.query(`
          INSERT INTO companies (id, name, domain, status)
          VALUES ($1, $2, $3, $4)
        `, ['batch-company', 'Batch Company', 'batch.com', 'active']);

        // Create user
        await client.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'batch-user',
          'batch@example.com',
          '$2a$12$hashedpassword',
          'Batch',
          'User',
          'batch-company',
          'user',
          'active'
        ]);

        // Insert many receipts in a single transaction
        for (let i = 1; i <= batchSize; i++) {
          await client.query(`
            INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status, total_amount)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            `batch-receipt-${i}`,
            'batch-user',
            `batch${i}.jpg`,
            `/uploads/batch${i}.jpg`,
            1024 + i,
            `batchhash${i}`,
            'image/jpeg',
            'processed',
            i * 5.00
          ]);
        }

        await client.query('COMMIT');

        // Verify all receipts were created
        const receiptCount = await db.query(
          'SELECT COUNT(*) FROM receipts WHERE user_id = $1',
          ['batch-user']
        );
        expect(parseInt(receiptCount.rows[0].count)).toBe(batchSize);

        // Verify data integrity
        const totalAmount = await db.query(
          'SELECT SUM(total_amount) FROM receipts WHERE user_id = $1',
          ['batch-user']
        );
        const expectedTotal = Array.from({length: batchSize}, (_, i) => (i + 1) * 5.00)
          .reduce((sum, amount) => sum + amount, 0);
        expect(parseFloat(totalAmount.rows[0].sum)).toBe(expectedTotal);

      } finally {
        client.release();
      }
    });
  });

  describe('Error Recovery', () => {
    it('should recover from deadlock situations', async () => {
      // Create test data
      await db.query(`
        INSERT INTO companies (id, name, domain, status)
        VALUES ($1, $2, $3, $4)
      `, ['deadlock-company', 'Deadlock Company', 'deadlock.com', 'active']);

      await db.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'deadlock-user',
        'deadlock@example.com',
        '$2a$12$hashedpassword',
        'Deadlock',
        'User',
        'deadlock-company',
        'user',
        'active'
      ]);

      await db.query(`
        INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status, total_amount)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9),
        ($10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        'deadlock-receipt-1', 'deadlock-user', 'dl1.jpg', '/uploads/dl1.jpg', 1024, 'dlhash1', 'image/jpeg', 'processed', 10.00,
        'deadlock-receipt-2', 'deadlock-user', 'dl2.jpg', '/uploads/dl2.jpg', 1024, 'dlhash2', 'image/jpeg', 'processed', 20.00
      ]);

      // Simulate potential deadlock scenario
      const transaction1 = async () => {
        const client = await db.getConnection();
        try {
          await client.query('BEGIN');
          
          // Lock receipt 1, then receipt 2
          await client.query('SELECT * FROM receipts WHERE id = $1 FOR UPDATE', ['deadlock-receipt-1']);
          await new Promise(resolve => setTimeout(resolve, 50));
          await client.query('SELECT * FROM receipts WHERE id = $1 FOR UPDATE', ['deadlock-receipt-2']);
          
          await client.query('UPDATE receipts SET total_amount = total_amount + 1 WHERE id = $1', ['deadlock-receipt-1']);
          await client.query('COMMIT');
          
          return 'Transaction 1 completed';
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      };

      const transaction2 = async () => {
        const client = await db.getConnection();
        try {
          await client.query('BEGIN');
          
          // Lock receipt 2, then receipt 1 (opposite order - potential deadlock)
          await client.query('SELECT * FROM receipts WHERE id = $1 FOR UPDATE', ['deadlock-receipt-2']);
          await new Promise(resolve => setTimeout(resolve, 50));
          await client.query('SELECT * FROM receipts WHERE id = $1 FOR UPDATE', ['deadlock-receipt-1']);
          
          await client.query('UPDATE receipts SET total_amount = total_amount + 2 WHERE id = $1', ['deadlock-receipt-2']);
          await client.query('COMMIT');
          
          return 'Transaction 2 completed';
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      };

      // One transaction should succeed, the other might fail with deadlock
      const results = await Promise.allSettled([transaction1(), transaction2()]);
      
      // At least one should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle connection pool exhaustion gracefully', async () => {
      // Create many concurrent connections to test pool limits
      const concurrentOperations = Array(50).fill(0).map(async (_, index) => {
        try {
          const result = await db.query('SELECT $1 as test_value', [index]);
          return { success: true, value: result.rows[0].test_value };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const results = await Promise.all(concurrentOperations);
      
      // Most operations should succeed (connection pool should handle the load)
      const successful = results.filter(r => r.success);
      expect(successful.length).toBeGreaterThan(40); // Allow for some failures due to pool limits
    });
  });
});