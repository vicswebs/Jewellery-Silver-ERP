import { Router } from 'express';
import { eq, ilike, or, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { customers, customerGroups, ledgerEntries, sales } from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

const customerSchema = z.object({
  code: z.string().min(1).max(30).optional(),
  name: z.string().min(1).max(200),
  mobile: z.string().max(20).optional().nullable(),
  altMobile: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  gstin: z.string().max(20).optional().nullable(),
  pan: z.string().max(20).optional().nullable(),
  groupId: z.number().int().optional().nullable(),
  openingBalance: z.string().or(z.number()).optional(),
  openingFine: z.string().or(z.number()).optional(),
  openingRoopu: z.string().or(z.number()).optional(),
  creditLimit: z.string().or(z.number()).optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

// List + Search
router.get('/', async (req, res, next) => {
  try {
    const { search, status, page = '1', limit = '50' } = req.query as {
      search?: string;
      status?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        mobile: customers.mobile,
        city: customers.city,
        groupId: customers.groupId,
        groupName: customerGroups.name,
        status: customers.status,
        openingBalance: customers.openingBalance,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .leftJoin(customerGroups, eq(customers.groupId, customerGroups.id))
      .$dynamic();

    const conditions = [];

    if (search) {
      const s = `%${search}%`;

      conditions.push(
        or(
          ilike(customers.name, s),
          ilike(customers.mobile, s),
          ilike(customers.code, s)
        )
      );
    }

    if (status) {
      conditions.push(
        eq(customers.status, status as 'active' | 'inactive')
      );
    }

    if (conditions.length) {
      query = query.where(
        sql`${sql.join(conditions, sql` AND `)}`
      );
    }

    const data = await query
      .orderBy(desc(customers.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      success: true,
      data,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    next(err);
  }
});

// Get single + balance summary
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Simple balance calculation from ledger
    const [balance] = await db
      .select({
        debit: sql<string>`COALESCE(SUM(${ledgerEntries.debit}), 0)`,
        credit: sql<string>`COALESCE(SUM(${ledgerEntries.credit}), 0)`,
        fineDebit: sql<string>`COALESCE(SUM(${ledgerEntries.fineDebit}), 0)`,
        fineCredit: sql<string>`COALESCE(SUM(${ledgerEntries.fineCredit}), 0)`,
      })
      .from(ledgerEntries)
      .where(
        sql`${ledgerEntries.partyType} = 'customer' AND ${ledgerEntries.partyId} = ${id}`
      );

    const opening = parseFloat(customer.openingBalance || '0');
    const debit = parseFloat(balance?.debit || '0');
    const credit = parseFloat(balance?.credit || '0');
    const currentBalance = opening + debit - credit;

    res.json({
      success: true,
      data: {
        ...customer,
        currentBalance,
        fineBalance:
          parseFloat(customer.openingFine || '0') +
          parseFloat(balance?.fineDebit || '0') -
          parseFloat(balance?.fineCredit || '0'),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Create
router.post(
  '/',
  authorize('customers.create', 'customers.*'),
  async (req, res, next) => {
    try {
      const body = customerSchema.parse(req.body);

      // Auto code if not provided
      let code = body.code;

      if (!code) {
        const [last] = await db
          .select({ code: customers.code })
          .from(customers)
          .orderBy(desc(customers.id))
          .limit(1);

        const nextNum = last
          ? parseInt(last.code.replace(/\D/g, '') || '0', 10) + 1
          : 1;

        code = `C${String(nextNum).padStart(5, '0')}`;
      }

      const [created] = await db
        .insert(customers)
        .values({
          ...body,
          code,
          email: body.email || null,
          openingBalance: String(body.openingBalance ?? 0),
          openingFine: String(body.openingFine ?? 0),
          openingRoopu: String(body.openingRoopu ?? 0),
          creditLimit: String(body.creditLimit ?? 0),
          createdBy: req.user!.id,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Update
router.put(
  '/:id',
  authorize('customers.edit', 'customers.*'),
  async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const body = customerSchema.partial().parse(req.body);

      const [updated] = await db
        .update(customers)
        .set({
          ...body,
          email: body.email || null,
          openingBalance:
            body.openingBalance != null
              ? String(body.openingBalance)
              : undefined,
          openingFine:
            body.openingFine != null
              ? String(body.openingFine)
              : undefined,
          openingRoopu:
            body.openingRoopu != null
              ? String(body.openingRoopu)
              : undefined,
          creditLimit:
            body.creditLimit != null
              ? String(body.creditLimit)
              : undefined,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();

      if (!updated) {
        throw new AppError('Customer not found', 404);
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Toggle active / inactive
router.patch(
  '/:id/status',
  authorize('customers.edit', 'customers.*'),
  async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const { status } = req.body as {
        status?: 'active' | 'inactive';
      };

      if (status !== 'active' && status !== 'inactive') {
        throw new AppError(
          'Status must be active or inactive',
          400
        );
      }

      const [updated] = await db
        .update(customers)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();

      if (!updated) {
        throw new AppError('Customer not found', 404);
      }

      res.json({
        success: true,
        message:
          status === 'active'
            ? 'Customer activated'
            : 'Customer deactivated',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Soft delete (deactivate) OR hard delete (?hard=true)
router.delete(
  '/:id',
  authorize('customers.delete', 'customers.*'),
  async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const hard =
        String(
          (req.query as { hard?: string }).hard || ''
        ) === 'true';

      if (hard) {
        // Check if customer has sales
        const [saleCount] = await db
          .select({
            count: sql`COUNT(*)`.mapWith(String),
          })
          .from(sales)
          .where(eq(sales.customerId, id));

        const salesNum = parseInt(
          String(saleCount?.count || '0'),
          10
        );

        // Check ledger entries
        const [ledgerCount] = await db
          .select({
            count: sql`COUNT(*)`.mapWith(String),
          })
          .from(ledgerEntries)
          .where(
            sql`${ledgerEntries.partyType} = 'customer' AND ${ledgerEntries.partyId} = ${id}`
          );

        const ledgerNum = parseInt(
          String(ledgerCount?.count || '0'),
          10
        );

        if (salesNum > 0 || ledgerNum > 0) {
          throw new AppError(
            `Cannot permanently delete this customer. ` +
              `They have ${salesNum} sale(s) and ${ledgerNum} ledger entr${ledgerNum === 1 ? 'y' : 'ies'}. ` +
              `Use "Set Inactive" instead so account history stays safe.`,
            400
          );
        }

        const [deleted] = await db
          .delete(customers)
          .where(eq(customers.id, id))
          .returning();

        if (!deleted) {
          throw new AppError(
            'Customer not found',
            404
          );
        }

        return res.json({
          success: true,
          message: 'Customer permanently deleted',
        });
      }

      // Soft delete = inactive
      const [updated] = await db
        .update(customers)
        .set({
          status: 'inactive',
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();

      if (!updated) {
        throw new AppError(
          'Customer not found',
          404
        );
      }

      res.json({
        success: true,
        message: 'Customer deactivated',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ========== Customer Account / Ledger ==========

// List for dropdown: id + code + name
router.get('/lookup/list', async (_req, res, next) => {
  try {
    const data = await db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        mobile: customers.mobile,
      })
      .from(customers)
      .where(eq(customers.status, 'active'))
      .orderBy(customers.name);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// Account summary + ledger entries
router.get('/:id/account', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const { fromDate, toDate } = req.query as {
      fromDate?: string;
      toDate?: string;
    };

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!customer) {
      throw new AppError(
        'Customer not found',
        404
      );
    }

    const conditions = [
      sql`${ledgerEntries.partyType} = 'customer'`,
      sql`${ledgerEntries.partyId} = ${id}`,
    ];

    if (fromDate) {
      conditions.push(
        sql`${ledgerEntries.entryDate} >= ${String(fromDate)}`
      );
    }

    if (toDate) {
      conditions.push(
        sql`${ledgerEntries.entryDate} <= ${String(toDate)}`
      );
    }

    const entries = await db
      .select({
        id: ledgerEntries.id,
        entryDate: ledgerEntries.entryDate,
        ledgerType: ledgerEntries.ledgerType,
        referenceNo: ledgerEntries.referenceNo,
        debit: ledgerEntries.debit,
        credit: ledgerEntries.credit,
        fineDebit: ledgerEntries.fineDebit,
        fineCredit: ledgerEntries.fineCredit,
        narration: ledgerEntries.narration,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .where(
        sql`${sql.join(conditions, sql` AND `)}`
      )
      .orderBy(
        ledgerEntries.entryDate,
        ledgerEntries.id
      );

    const openingBal = parseFloat(
      customer.openingBalance || '0'
    );

    const openingFine = parseFloat(
      customer.openingFine || '0'
    );

    let runBal = openingBal;
    let runFine = openingFine;
    let totalDebit = 0;
    let totalCredit = 0;

    const rows = entries.map((e) => {
      const debit = parseFloat(
        String(e.debit || 0)
      );

      const credit = parseFloat(
        String(e.credit || 0)
      );

      const fDebit = parseFloat(
        String(e.fineDebit || 0)
      );

      const fCredit = parseFloat(
        String(e.fineCredit || 0)
      );

      totalDebit += debit;
      totalCredit += credit;

      runBal = runBal + debit - credit;
      runFine = runFine + fDebit - fCredit;

      return {
        ...e,
        debit,
        credit,
        fineDebit: fDebit,
        fineCredit: fCredit,

        // Jama = receipt/credit (green)
        // Issue = payment/debit (red)
        type:
          credit > 0
            ? 'jama'
            : debit > 0
              ? 'issue'
              : 'other',

        runningBalance: runBal,
        runningFine: runFine,
      };
    });

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          code: customer.code,
          name: customer.name,
          mobile: customer.mobile,
          city: customer.city,
          openingBalance: openingBal,
          openingFine: openingFine,
        },

        summary: {
          openingBalance: openingBal,
          totalDebit,
          totalCredit,
          closingBalance: runBal,
          closingFine: runFine,
        },

        entries: rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
