import bcrypt from 'bcryptjs';
import { db } from './index.js';
import {
  roles,
  users,
  settings,
  invoiceSequences,
  categories,
  cashAccounts,
  bankAccounts,
  customerGroups,
} from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding database...');

  // Roles
  const [superAdminRole] = await db
    .insert(roles)
    .values({
      name: 'Super Admin',
      description: 'Full system access',
      permissions: ['*'],
    })
    .onConflictDoNothing()
    .returning();

  const [adminRole] = await db
    .insert(roles)
    .values({
      name: 'Admin',
      description: 'Administrative access',
      permissions: [
        'customers.*',
        'suppliers.*',
        'items.*',
        'sales.*',
        'purchases.*',
        'payments.*',
        'receipts.*',
        'reports.*',
        'stock.*',
        'rates.*',
        'settings.view',
      ],
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(roles)
    .values({
      name: 'Billing User',
      description: 'Billing and basic operations',
      permissions: [
        'customers.view',
        'customers.create',
        'items.view',
        'sales.*',
        'payments.create',
        'receipts.create',
        'stock.view',
      ],
    })
    .onConflictDoNothing();

  await db
    .insert(roles)
    .values({
      name: 'Accounts User',
      description: 'Accounts and ledger access',
      permissions: [
        'customers.view',
        'suppliers.view',
        'payments.*',
        'receipts.*',
        'reports.*',
        'ledger.*',
      ],
    })
    .onConflictDoNothing();

  await db
    .insert(roles)
    .values({
      name: 'Viewer',
      description: 'Read-only access',
      permissions: ['*.view', 'reports.view'],
    })
    .onConflictDoNothing();

  // Default Admin User
  const passwordHash = await bcrypt.hash('admin123', 12);
  await db
    .insert(users)
    .values({
      username: 'admin',
      passwordHash,
      fullName: 'System Administrator',
      roleId: superAdminRole?.id || 1,
      status: 'active',
    })
    .onConflictDoNothing();

  // Settings
  const defaultSettings = [
    { key: 'company_name', value: 'Ritik Chains', description: 'Company name' },
    { key: 'company_address', value: '', description: 'Company address' },
    { key: 'company_phone', value: '', description: 'Company phone' },
    { key: 'company_gstin', value: '', description: 'GSTIN' },
    { key: 'developer', value: 'ToolClub.website', description: 'Developer' },
    { key: 'currency_symbol', value: '₹', description: 'Currency symbol' },
    { key: 'weight_unit', value: 'g', description: 'Default weight unit' },
    { key: 'fine_precision', value: 4, description: 'Fine decimal places' },
    { key: 'amount_precision', value: 2, description: 'Amount decimal places' },
    { key: 'allow_negative_stock', value: false, description: 'Allow negative stock' },
  ];

  for (const s of defaultSettings) {
    await db.insert(settings).values(s).onConflictDoNothing();
  }

  // Invoice sequences
  const sequences = [
    { prefix: 'SALE-', currentNumber: 0, padding: 6, description: 'Sales Invoice' },
    { prefix: 'PUR-', currentNumber: 0, padding: 6, description: 'Purchase Invoice' },
    { prefix: 'SR-', currentNumber: 0, padding: 6, description: 'Sales Return' },
    { prefix: 'PR-', currentNumber: 0, padding: 6, description: 'Purchase Return' },
    { prefix: 'PAY-', currentNumber: 0, padding: 6, description: 'Payment' },
    { prefix: 'REC-', currentNumber: 0, padding: 6, description: 'Receipt' },
  ];

  for (const seq of sequences) {
    await db.insert(invoiceSequences).values(seq).onConflictDoNothing();
  }

  // Default categories
  await db
    .insert(categories)
    .values([
      { name: 'Chains', description: 'Silver / Gold Chains' },
      { name: 'Bangles', description: 'Bangles & Bracelets' },
      { name: 'Rings', description: 'Finger Rings' },
      { name: 'Earrings', description: 'Earrings' },
      { name: 'Pendants', description: 'Pendants & Lockets' },
      { name: 'Bullion', description: 'Raw silver / fine' },
      { name: 'Other', description: 'Miscellaneous' },
    ])
    .onConflictDoNothing();

  // Customer groups
  await db
    .insert(customerGroups)
    .values([
      { name: 'Retail', description: 'Retail customers' },
      { name: 'Wholesale', description: 'Wholesale customers' },
      { name: 'VIP', description: 'VIP customers' },
    ])
    .onConflictDoNothing();

  // Cash account
  await db
    .insert(cashAccounts)
    .values({
      name: 'Main Cash',
      openingBalance: '0',
      currentBalance: '0',
    })
    .onConflictDoNothing();

  // Bank account placeholder
  await db
    .insert(bankAccounts)
    .values({
      name: 'Primary Bank',
      bankName: 'Bank Name',
      openingBalance: '0',
      currentBalance: '0',
    })
    .onConflictDoNothing();

  console.log('Seed completed successfully.');
  console.log('Default login → username: admin  |  password: admin123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
