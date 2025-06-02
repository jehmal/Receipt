-- Forever Receipt Vault Seed Data
-- Test data for development and demonstration

-- Insert test companies
INSERT INTO companies (id, name, domain, admin_user_id, subscription_tier, max_users, settings) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Acme Corporation', 'acme.com', '550e8400-e29b-41d4-a716-446655440011', 'enterprise', 100, '{"theme": "dark", "auto_categorization": true}'),
('550e8400-e29b-41d4-a716-446655440002', 'TechStart Inc', 'techstart.io', '550e8400-e29b-41d4-a716-446655440012', 'business', 25, '{"theme": "light", "approval_required": true}');

-- Insert test users
INSERT INTO users (id, email, password_hash, first_name, last_name, role, subscription_tier, company_id, email_verified) VALUES
-- Individual users
('550e8400-e29b-41d4-a716-446655440011', 'john.doe@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LebrHtVpQyK2fXKlm', 'John', 'Doe', 'individual', 'personal', NULL, TRUE),
('550e8400-e29b-41d4-a716-446655440012', 'jane.smith@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LebrHtVpQyK2fXKlm', 'Jane', 'Smith', 'individual', 'free', NULL, TRUE),

-- Company admin
('550e8400-e29b-41d4-a716-446655440013', 'admin@acme.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LebrHtVpQyK2fXKlm', 'Alice', 'Johnson', 'company_admin', 'enterprise', '550e8400-e29b-41d4-a716-446655440001', TRUE),
('550e8400-e29b-41d4-a716-446655440014', 'admin@techstart.io', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LebrHtVpQyK2fXKlm', 'Bob', 'Wilson', 'company_admin', 'business', '550e8400-e29b-41d4-a716-446655440002', TRUE),

-- Company employees
('550e8400-e29b-41d4-a716-446655440015', 'employee1@acme.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LebrHtVpQyK2fXKlm', 'Charlie', 'Brown', 'company_employee', 'business', '550e8400-e29b-41d4-a716-446655440001', TRUE),
('550e8400-e29b-41d4-a716-446655440016', 'employee2@acme.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LebrHtVpQyK2fXKlm', 'Diana', 'Prince', 'company_employee', 'business', '550e8400-e29b-41d4-a716-446655440001', TRUE);

-- Update company admin references
UPDATE companies SET admin_user_id = '550e8400-e29b-41d4-a716-446655440013' WHERE id = '550e8400-e29b-41d4-a716-446655440001';
UPDATE companies SET admin_user_id = '550e8400-e29b-41d4-a716-446655440014' WHERE id = '550e8400-e29b-41d4-a716-446655440002';

-- Insert test receipts
INSERT INTO receipts (
    id, user_id, company_id, original_filename, file_path, file_size, file_hash, mime_type,
    ocr_text, ocr_confidence, status, vendor_name, total_amount, currency, receipt_date,
    category, tags, description
) VALUES
-- Individual user receipts
(
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440011',
    NULL,
    'starbucks_receipt.jpg',
    '/uploads/receipts/starbucks_receipt_001.jpg',
    1024000,
    'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
    'image/jpeg',
    'STARBUCKS COFFEE\n1234 Main St\nAnytown, CA 90210\n\nGrande Latte    $5.45\nTax             $0.55\nTotal           $6.00\n\nCard ****1234\nThank you!',
    0.95,
    'processed',
    'Starbucks Coffee',
    6.00,
    'USD',
    '2024-01-15',
    'Food & Beverage',
    ARRAY['coffee', 'business meal'],
    'Morning coffee before client meeting'
),
(
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440011',
    NULL,
    'uber_receipt.jpg',
    '/uploads/receipts/uber_receipt_001.jpg',
    856000,
    'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1',
    'image/jpeg',
    'Uber Receipt\nTrip from Home to Airport\nFare: $45.00\nTip: $9.00\nTotal: $54.00\nJan 20, 2024',
    0.92,
    'processed',
    'Uber Technologies Inc',
    54.00,
    'USD',
    '2024-01-20',
    'Transportation',
    ARRAY['business travel', 'airport'],
    'Trip to airport for business travel'
),

-- Company receipts
(
    '660e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440015',
    '550e8400-e29b-41d4-a716-446655440001',
    'office_supplies.jpg',
    '/uploads/receipts/office_supplies_001.jpg',
    1200000,
    'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2',
    'image/jpeg',
    'OFFICE DEPOT\n5678 Business Blvd\nBusiness City, CA 90211\n\nStapler          $12.99\nPaper Ream       $8.99\nPens (12 pack)   $5.99\nSubtotal         $27.97\nTax              $2.52\nTotal            $30.49',
    0.88,
    'processed',
    'Office Depot',
    30.49,
    'USD',
    '2024-01-18',
    'Office Supplies',
    ARRAY['supplies', 'stationery'],
    'Office supplies for Q1 project'
),
(
    '660e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440016',
    '550e8400-e29b-41d4-a716-446655440001',
    'team_lunch.jpg',
    '/uploads/receipts/team_lunch_001.jpg',
    980000,
    'd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2c3',
    'image/jpeg',
    'ITALIAN BISTRO\n789 Restaurant Row\nFoodtown, CA 90212\n\nTable for 6\nEntrees (6x)     $120.00\nAppetizers       $24.00\nDrinks           $36.00\nSubtotal         $180.00\nTip              $32.40\nTax              $16.20\nTotal            $228.60',
    0.91,
    'processed',
    'Italian Bistro',
    228.60,
    'USD',
    '2024-01-22',
    'Meals & Entertainment',
    ARRAY['team meal', 'client entertainment'],
    'Team lunch with new clients'
);

-- Insert receipt items for detailed line items
INSERT INTO receipt_items (receipt_id, line_number, description, quantity, unit_price, total_price, category) VALUES
('660e8400-e29b-41d4-a716-446655440001', 1, 'Grande Latte', 1, 5.45, 5.45, 'Beverage'),
('660e8400-e29b-41d4-a716-446655440001', 2, 'Tax', 1, 0.55, 0.55, 'Tax'),

('660e8400-e29b-41d4-a716-446655440003', 1, 'Stapler', 1, 12.99, 12.99, 'Office Equipment'),
('660e8400-e29b-41d4-a716-446655440003', 2, 'Paper Ream', 1, 8.99, 8.99, 'Paper Products'),
('660e8400-e29b-41d4-a716-446655440003', 3, 'Pens (12 pack)', 1, 5.99, 5.99, 'Writing Supplies'),

('660e8400-e29b-41d4-a716-446655440004', 1, 'Entrees', 6, 20.00, 120.00, 'Food'),
('660e8400-e29b-41d4-a716-446655440004', 2, 'Appetizers', 1, 24.00, 24.00, 'Food'),
('660e8400-e29b-41d4-a716-446655440004', 3, 'Drinks', 1, 36.00, 36.00, 'Beverage');

-- Insert additional tags
INSERT INTO receipt_tags (receipt_id, tag_name, tag_value, confidence_score, source) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'expense_type', 'business', 0.9, 'manual'),
('660e8400-e29b-41d4-a716-446655440001', 'deductible', 'true', 1.0, 'manual'),
('660e8400-e29b-41d4-a716-446655440002', 'trip_purpose', 'business', 1.0, 'manual'),
('660e8400-e29b-41d4-a716-446655440002', 'client', 'ABC Corp', 1.0, 'manual'),
('660e8400-e29b-41d4-a716-446655440003', 'project', 'Q1-2024', 1.0, 'manual'),
('660e8400-e29b-41d4-a716-446655440003', 'department', 'Marketing', 1.0, 'manual'),
('660e8400-e29b-41d4-a716-446655440004', 'attendees', '6', 1.0, 'ocr'),
('660e8400-e29b-41d4-a716-446655440004', 'event_type', 'client_meeting', 1.0, 'manual');

-- Insert email inbox configurations
INSERT INTO email_inboxes (user_id, email_address, auto_process, default_category, default_tags, allowed_senders) VALUES
(
    '550e8400-e29b-41d4-a716-446655440011',
    'receipts-john-doe@vault.receiptvault.com',
    TRUE,
    'Miscellaneous',
    ARRAY['email-import'],
    ARRAY['noreply@amazon.com', 'receipts@uber.com', 'noreply@starbucks.com']
),
(
    '550e8400-e29b-41d4-a716-446655440015',
    'receipts-charlie-acme@vault.receiptvault.com',
    TRUE,
    'Business Expense',
    ARRAY['company-expense', 'auto-imported'],
    ARRAY['*@acme.com', 'receipts@*']
);

-- Insert sample audit logs
INSERT INTO audit_logs (user_id, company_id, action, resource_type, resource_id, new_values, ip_address, user_agent) VALUES
(
    '550e8400-e29b-41d4-a716-446655440011',
    NULL,
    'create',
    'receipt',
    '660e8400-e29b-41d4-a716-446655440001',
    '{"vendor_name": "Starbucks Coffee", "total_amount": 6.00}',
    '192.168.1.100',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
),
(
    '550e8400-e29b-41d4-a716-446655440015',
    '550e8400-e29b-41d4-a716-446655440001',
    'create',
    'receipt',
    '660e8400-e29b-41d4-a716-446655440003',
    '{"vendor_name": "Office Depot", "total_amount": 30.49}',
    '10.0.1.50',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
);

-- Show summary
SELECT 
    'Database seeded successfully!' as status,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM companies) as total_companies,
    (SELECT COUNT(*) FROM receipts) as total_receipts,
    (SELECT COUNT(*) FROM receipt_items) as total_receipt_items,
    (SELECT COUNT(*) FROM receipt_tags) as total_tags;