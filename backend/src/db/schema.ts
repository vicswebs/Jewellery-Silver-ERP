import {
  pgTable,
  serial,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== ENUMS ====================
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'locked']);
export const partyStatusEnum = pgEnum('party_status', ['active', 'inactive']);
export const itemStatusEnum = pgEnum('item_status', ['active', 'inactive']);
export const transactionStatusEnum = pgEnum('transaction_status', [
  'draft',
  'confirmed',
  'cancelled',
  'reversed',
]);
export const paymentModeEnum = pgEnum('payment_mode', ['cash', 'bank', 'fine', 'roopu', 'adjustment']);
export const ledgerTypeEnum = pgEnum('ledger_type', [
  'sale',
  'purchase',
  'sale_return',
  'purchase_return',
  'payment',
  'receipt',
  'rate_cut',
  'badla',
  'adjustment',
  'opening',
  'stock_adjustment',
]);
export const metalTypeEnum = pgEnum('metal_type', ['fine', 'roopu', 'silver', 'gold', 'other']);

// ==================== USERS & ROLES ====================
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 50 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    email: varchar('email', { length: 150 }),
    mobile: varchar('mobile', { length: 20 }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id),
    status: userStatusEnum('status').default('active').notNull(),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('users_role_idx').on(t.roleId)]
);

// ==================== COMPANY / SETTINGS ====================
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value'),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const invoiceSequences = pgTable('invoice_sequences', {
  id: serial('id').primaryKey(),
  prefix: varchar('prefix', { length: 20 }).notNull(),
  currentNumber: integer('current_number').default(0).notNull(),
  padding: integer('padding').default(6).notNull(),
  description: varchar('description', { length: 100 }),
});

// ==================== MASTER DATA ====================
export const customerGroups = pgTable('customer_groups', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  status: partyStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 30 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    mobile: varchar('mobile', { length: 20 }),
    altMobile: varchar('alt_mobile', { length: 20 }),
    email: varchar('email', { length: 150 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    gstin: varchar('gstin', { length: 20 }),
    pan: varchar('pan', { length: 20 }),
    groupId: integer('group_id').references(() => customerGroups.id),
    priceListId: integer('price_list_id'),
    openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).default('0'),
    openingFine: numeric('opening_fine', { precision: 18, scale: 4 }).default('0'),
    openingRoopu: numeric('opening_roopu', { precision: 18, scale: 4 }).default('0'),
    creditLimit: numeric('credit_limit', { precision: 18, scale: 2 }).default('0'),
    notes: text('notes'),
    status: partyStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: integer('created_by').references(() => users.id),
  },
  (t) => [
    index('customers_name_idx').on(t.name),
    index('customers_mobile_idx').on(t.mobile),
    index('customers_code_idx').on(t.code),
  ]
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 30 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    contact: varchar('contact', { length: 20 }),
    email: varchar('email', { length: 150 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    gstin: varchar('gstin', { length: 20 }),
    pan: varchar('pan', { length: 20 }),
    openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).default('0'),
    openingFine: numeric('opening_fine', { precision: 18, scale: 4 }).default('0'),
    openingRoopu: numeric('opening_roopu', { precision: 18, scale: 4 }).default('0'),
    notes: text('notes'),
    status: partyStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: integer('created_by').references(() => users.id),
  },
  (t) => [
    index('suppliers_name_idx').on(t.name),
    index('suppliers_code_idx').on(t.code),
  ]
);

export const bullions = pgTable(
  'bullions',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 30 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    contact: varchar('contact', { length: 20 }),
    address: text('address'),
    openingFine: numeric('opening_fine', { precision: 18, scale: 4 }).default('0'),
    openingRoopu: numeric('opening_roopu', { precision: 18, scale: 4 }).default('0'),
    notes: text('notes'),
    status: partyStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('bullions_name_idx').on(t.name)]
);

// ==================== INVENTORY ====================
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  parentId: integer('parent_id'),
  description: text('description'),
  status: itemStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const items = pgTable(
  'items',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    categoryId: integer('category_id').references(() => categories.id),
    huid: varchar('huid', { length: 50 }),
    metalType: metalTypeEnum('metal_type').default('silver'),
    purity: numeric('purity', { precision: 8, scale: 4 }).default('0'),
    finePercent: numeric('fine_percent', { precision: 8, scale: 4 }).default('0'),
    grossWeight: numeric('gross_weight', { precision: 14, scale: 4 }).default('0'),
    netWeight: numeric('net_weight', { precision: 14, scale: 4 }).default('0'),
    wastage: numeric('wastage', { precision: 8, scale: 4 }).default('0'),
    makingCharge: numeric('making_charge', { precision: 12, scale: 2 }).default('0'),
    labourCharge: numeric('labour_charge', { precision: 12, scale: 2 }).default('0'),
    otherCharge: numeric('other_charge', { precision: 12, scale: 2 }).default('0'),
    saleRate: numeric('sale_rate', { precision: 14, scale: 2 }).default('0'),
    purchaseRate: numeric('purchase_rate', { precision: 14, scale: 2 }).default('0'),
    minStock: numeric('min_stock', { precision: 14, scale: 4 }).default('0'),
    currentQty: numeric('current_qty', { precision: 14, scale: 4 }).default('0'),
    currentGross: numeric('current_gross', { precision: 14, scale: 4 }).default('0'),
    currentNet: numeric('current_net', { precision: 14, scale: 4 }).default('0'),
    currentFine: numeric('current_fine', { precision: 14, scale: 4 }).default('0'),
    unit: varchar('unit', { length: 20 }).default('pcs'),
    notes: text('notes'),
    status: itemStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: integer('created_by').references(() => users.id),
  },
  (t) => [
    index('items_name_idx').on(t.name),
    index('items_code_idx').on(t.code),
    index('items_category_idx').on(t.categoryId),
  ]
);

// ==================== RATES & PRICE LISTS ====================
export const rates = pgTable(
  'rates',
  {
    id: serial('id').primaryKey(),
    metalType: metalTypeEnum('metal_type').notNull(),
    purity: numeric('purity', { precision: 8, scale: 4 }),
    buyRate: numeric('buy_rate', { precision: 14, scale: 2 }).notNull(),
    sellRate: numeric('sell_rate', { precision: 14, scale: 2 }).notNull(),
    fineRate: numeric('fine_rate', { precision: 14, scale: 2 }),
    effectiveFrom: timestamp('effective_from').defaultNow().notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('rates_metal_date_idx').on(t.metalType, t.effectiveFrom)]
);

export const priceLists = pgTable('price_lists', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  status: itemStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const priceListItems = pgTable(
  'price_list_items',
  {
    id: serial('id').primaryKey(),
    priceListId: integer('price_list_id')
      .notNull()
      .references(() => priceLists.id, { onDelete: 'cascade' }),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    rate: numeric('rate', { precision: 14, scale: 2 }).notNull(),
    making: numeric('making', { precision: 12, scale: 2 }).default('0'),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
  },
  (t) => [uniqueIndex('price_list_item_uniq').on(t.priceListId, t.itemId)]
);

export const customerItemRates = pgTable(
  'customer_item_rates',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    rate: numeric('rate', { precision: 14, scale: 2 }).notNull(),
    making: numeric('making', { precision: 12, scale: 2 }).default('0'),
    notes: text('notes'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('customer_item_rate_uniq').on(t.customerId, t.itemId)]
);

// ==================== SALES ====================
export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    invoiceNo: varchar('invoice_no', { length: 50 }).notNull().unique(),
    invoiceDate: date('invoice_date').notNull(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    salespersonId: integer('salesperson_id').references(() => users.id),

    totalGross: numeric('total_gross', { precision: 14, scale: 4 }).default('0'),
    totalNet: numeric('total_net', { precision: 14, scale: 4 }).default('0'),
    totalFine: numeric('total_fine', { precision: 14, scale: 4 }).default('0'),
    totalMaking: numeric('total_making', { precision: 14, scale: 2 }).default('0'),
    totalOther: numeric('total_other', { precision: 14, scale: 2 }).default('0'),

    discount: numeric('discount', { precision: 14, scale: 2 }).default('0'),
    taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).default('0'),

    // ========== NEW COLUMNS ==========
    parcelCharge: numeric('parcel_charge', { precision: 14, scale: 2 }).default('0'),
    kasar: numeric('kasar', { precision: 14, scale: 2 }).default('0'),
    rateCutAmount: numeric('rate_cut_amount', { precision: 14, scale: 2 }).default('0'),
    receivedFine: numeric('received_fine', { precision: 14, scale: 4 }).default('0'),
    fineBalance: numeric('fine_balance', { precision: 14, scale: 4 }).default('0'),
    // ================================

    grandTotal: numeric('grand_total', { precision: 18, scale: 2 }).notNull(),
    paidAmount: numeric('paid_amount', { precision: 18, scale: 2 }).default('0'),
    dueAmount: numeric('due_amount', { precision: 18, scale: 2 }).default('0'),

    paymentMode: paymentModeEnum('payment_mode'),
    status: transactionStatusEnum('status').default('confirmed').notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('sales_date_idx').on(t.invoiceDate),
    index('sales_customer_idx').on(t.customerId),
    index('sales_invoice_idx').on(t.invoiceNo),
  ]
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),

    quantity: numeric('quantity', { precision: 12, scale: 4 }).default('1'),
    grossWeight: numeric('gross_weight', { precision: 14, scale: 4 }).notNull(),

    // ========== NEW COLUMNS ==========
    bagWeight: numeric('bag_weight', { precision: 14, scale: 4 }).default('0'),
    wastage: numeric('wastage', { precision: 8, scale: 4 }).default('0'),
    // ================================

    stoneWeight: numeric('stone_weight', { precision: 12, scale: 4 }).default('0'),
    netWeight: numeric('net_weight', { precision: 14, scale: 4 }).notNull(),
    purity: numeric('purity', { precision: 8, scale: 4 }).default('0'),
    fineWeight: numeric('fine_weight', { precision: 14, scale: 4 }).default('0'),
    rate: numeric('rate', { precision: 14, scale: 2 }).notNull(),
    makingCharge: numeric('making_charge', { precision: 12, scale: 2 }).default('0'),
    labourCharge: numeric('labour_charge', { precision: 12, scale: 2 }).default('0'),
    otherCharge: numeric('other_charge', { precision: 12, scale: 2 }).default('0'),
    discount: numeric('discount', { precision: 12, scale: 2 }).default('0'),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    notes: text('notes'),
  },
  (t) => [index('sale_items_sale_idx').on(t.saleId)]
);

// ==================== PURCHASES ====================
export const purchases = pgTable(
  'purchases',
  {
    id: serial('id').primaryKey(),
    invoiceNo: varchar('invoice_no', { length: 50 }).notNull().unique(),
    invoiceDate: date('invoice_date').notNull(),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    totalGross: numeric('total_gross', { precision: 14, scale: 4 }).default('0'),
    totalNet: numeric('total_net', { precision: 14, scale: 4 }).default('0'),
    totalFine: numeric('total_fine', { precision: 14, scale: 4 }).default('0'),
    totalMaking: numeric('total_making', { precision: 14, scale: 2 }).default('0'),
    totalOther: numeric('total_other', { precision: 14, scale: 2 }).default('0'),
    discount: numeric('discount', { precision: 14, scale: 2 }).default('0'),
    taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).default('0'),
    grandTotal: numeric('grand_total', { precision: 18, scale: 2 }).notNull(),
    paidAmount: numeric('paid_amount', { precision: 18, scale: 2 }).default('0'),
    dueAmount: numeric('due_amount', { precision: 18, scale: 2 }).default('0'),
    paymentMode: paymentModeEnum('payment_mode'),
    status: transactionStatusEnum('status').default('confirmed').notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('purchases_date_idx').on(t.invoiceDate),
    index('purchases_supplier_idx').on(t.supplierId),
  ]
);

export const purchaseItems = pgTable(
  'purchase_items',
  {
    id: serial('id').primaryKey(),
    purchaseId: integer('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    quantity: numeric('quantity', { precision: 12, scale: 4 }).default('1'),
    grossWeight: numeric('gross_weight', { precision: 14, scale: 4 }).notNull(),
    netWeight: numeric('net_weight', { precision: 14, scale: 4 }).notNull(),
    purity: numeric('purity', { precision: 8, scale: 4 }).default('0'),
    fineWeight: numeric('fine_weight', { precision: 14, scale: 4 }).default('0'),
    rate: numeric('rate', { precision: 14, scale: 2 }).notNull(),
    makingCharge: numeric('making_charge', { precision: 12, scale: 2 }).default('0'),
    otherCharge: numeric('other_charge', { precision: 12, scale: 2 }).default('0'),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    notes: text('notes'),
  },
  (t) => [index('purchase_items_purchase_idx').on(t.purchaseId)]
);

// ==================== RETURNS ====================
export const salesReturns = pgTable('sales_returns', {
  id: serial('id').primaryKey(),
  returnNo: varchar('return_no', { length: 50 }).notNull().unique(),
  returnDate: date('return_date').notNull(),
  saleId: integer('sale_id').references(() => sales.id),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  totalFine: numeric('total_fine', { precision: 14, scale: 4 }).default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  refundAmount: numeric('refund_amount', { precision: 18, scale: 2 }).default('0'),
  status: transactionStatusEnum('status').default('confirmed').notNull(),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const salesReturnItems = pgTable('sales_return_items', {
  id: serial('id').primaryKey(),
  salesReturnId: integer('sales_return_id')
    .notNull()
    .references(() => salesReturns.id, { onDelete: 'cascade' }),
  itemId: integer('item_id')
    .notNull()
    .references(() => items.id),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).default('1'),
  grossWeight: numeric('gross_weight', { precision: 14, scale: 4 }).notNull(),
  netWeight: numeric('net_weight', { precision: 14, scale: 4 }).notNull(),
  fineWeight: numeric('fine_weight', { precision: 14, scale: 4 }).default('0'),
  rate: numeric('rate', { precision: 14, scale: 2 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
});

export const purchaseReturns = pgTable('purchase_returns', {
  id: serial('id').primaryKey(),
  returnNo: varchar('return_no', { length: 50 }).notNull().unique(),
  returnDate: date('return_date').notNull(),
  purchaseId: integer('purchase_id').references(() => purchases.id),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  totalFine: numeric('total_fine', { precision: 14, scale: 4 }).default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  status: transactionStatusEnum('status').default('confirmed').notNull(),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchaseReturnItems = pgTable('purchase_return_items', {
  id: serial('id').primaryKey(),
  purchaseReturnId: integer('purchase_return_id')
    .notNull()
    .references(() => purchaseReturns.id, { onDelete: 'cascade' }),
  itemId: integer('item_id')
    .notNull()
    .references(() => items.id),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).default('1'),
  grossWeight: numeric('gross_weight', { precision: 14, scale: 4 }).notNull(),
  netWeight: numeric('net_weight', { precision: 14, scale: 4 }).notNull(),
  fineWeight: numeric('fine_weight', { precision: 14, scale: 4 }).default('0'),
  rate: numeric('rate', { precision: 14, scale: 2 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
});

// ==================== PAYMENTS & RECEIPTS ====================
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    paymentNo: varchar('payment_no', { length: 50 }).notNull().unique(),
    paymentDate: date('payment_date').notNull(),
    partyType: varchar('party_type', { length: 20 }).notNull(), // customer | supplier | bullion
    partyId: integer('party_id').notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).default('0'),
    fineAmount: numeric('fine_amount', { precision: 14, scale: 4 }).default('0'),
    roopuAmount: numeric('roopu_amount', { precision: 14, scale: 4 }).default('0'),
    paymentMode: paymentModeEnum('payment_mode').notNull(),
    bankAccountId: integer('bank_account_id'),
    referenceNo: varchar('reference_no', { length: 100 }),
    notes: text('notes'),
    status: transactionStatusEnum('status').default('confirmed').notNull(),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('payments_party_idx').on(t.partyType, t.partyId)]
);

export const receipts = pgTable(
  'receipts',
  {
    id: serial('id').primaryKey(),
    receiptNo: varchar('receipt_no', { length: 50 }).notNull().unique(),
    receiptDate: date('receipt_date').notNull(),
    partyType: varchar('party_type', { length: 20 }).notNull(),
    partyId: integer('party_id').notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).default('0'),
    fineAmount: numeric('fine_amount', { precision: 14, scale: 4 }).default('0'),
    roopuAmount: numeric('roopu_amount', { precision: 14, scale: 4 }).default('0'),
    paymentMode: paymentModeEnum('payment_mode').notNull(),
    bankAccountId: integer('bank_account_id'),
    referenceNo: varchar('reference_no', { length: 100 }),
    notes: text('notes'),
    status: transactionStatusEnum('status').default('confirmed').notNull(),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('receipts_party_idx').on(t.partyType, t.partyId)]
);

// ==================== LEDGER & MOVEMENTS ====================
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: serial('id').primaryKey(),
    entryDate: date('entry_date').notNull(),
    partyType: varchar('party_type', { length: 20 }).notNull(), // customer | supplier | bullion | cash | bank
    partyId: integer('party_id'),
    ledgerType: ledgerTypeEnum('ledger_type').notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: integer('reference_id'),
    referenceNo: varchar('reference_no', { length: 50 }),
    debit: numeric('debit', { precision: 18, scale: 2 }).default('0'),
    credit: numeric('credit', { precision: 18, scale: 2 }).default('0'),
    fineDebit: numeric('fine_debit', { precision: 14, scale: 4 }).default('0'),
    fineCredit: numeric('fine_credit', { precision: 14, scale: 4 }).default('0'),
    roopuDebit: numeric('roopu_debit', { precision: 14, scale: 4 }).default('0'),
    roopuCredit: numeric('roopu_credit', { precision: 14, scale: 4 }).default('0'),
    narration: text('narration'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('ledger_party_idx').on(t.partyType, t.partyId),
    index('ledger_date_idx').on(t.entryDate),
    index('ledger_ref_idx').on(t.referenceType, t.referenceId),
  ]
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: serial('id').primaryKey(),
    movementDate: date('movement_date').notNull(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    movementType: varchar('movement_type', { length: 30 }).notNull(), // sale | purchase | sale_return | purchase_return | adjustment
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: integer('reference_id'),
    quantityIn: numeric('quantity_in', { precision: 12, scale: 4 }).default('0'),
    quantityOut: numeric('quantity_out', { precision: 12, scale: 4 }).default('0'),
    grossIn: numeric('gross_in', { precision: 14, scale: 4 }).default('0'),
    grossOut: numeric('gross_out', { precision: 14, scale: 4 }).default('0'),
    netIn: numeric('net_in', { precision: 14, scale: 4 }).default('0'),
    netOut: numeric('net_out', { precision: 14, scale: 4 }).default('0'),
    fineIn: numeric('fine_in', { precision: 14, scale: 4 }).default('0'),
    fineOut: numeric('fine_out', { precision: 14, scale: 4 }).default('0'),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('stock_movements_item_idx').on(t.itemId),
    index('stock_movements_date_idx').on(t.movementDate),
  ]
);

// ==================== CASH / BANK ====================
export const cashAccounts = pgTable('cash_accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).default('0'),
  currentBalance: numeric('current_balance', { precision: 18, scale: 2 }).default('0'),
  status: partyStatusEnum('status').default('active').notNull(),
});

export const bankAccounts = pgTable('bank_accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  accountNo: varchar('account_no', { length: 50 }),
  bankName: varchar('bank_name', { length: 100 }),
  ifsc: varchar('ifsc', { length: 20 }),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).default('0'),
  currentBalance: numeric('current_balance', { precision: 18, scale: 2 }).default('0'),
  status: partyStatusEnum('status').default('active').notNull(),
});

// ==================== REMINDERS ====================
export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  reminderDate: date('reminder_date').notNull(),
  partyType: varchar('party_type', { length: 20 }),
  partyId: integer('party_id'),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  completedAt: timestamp('completed_at'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== ACTIVITY LOG ====================
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    module: varchar('module', { length: 50 }),
    recordType: varchar('record_type', { length: 50 }),
    recordId: integer('record_id'),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('activity_user_idx').on(t.userId),
    index('activity_module_idx').on(t.module),
    index('activity_date_idx').on(t.createdAt),
  ]
);

// ==================== RELATIONS ====================
export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  group: one(customerGroups, { fields: [customers.groupId], references: [customerGroups.id] }),
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  items: many(saleItems),
  salesperson: one(users, { fields: [sales.salespersonId], references: [users.id] }),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  item: one(items, { fields: [saleItems.itemId], references: [items.id] }),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  category: one(categories, { fields: [items.categoryId], references: [categories.id] }),
}));
