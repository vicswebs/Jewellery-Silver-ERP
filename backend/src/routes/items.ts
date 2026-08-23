import { Router } from 'express';
import { eq, ilike, or, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { items, categories, saleItems } from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

const numLike = z.union([z.string(), z.number()]).optional();

const itemSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200),
  categoryId: z.number().int().optional().nullable(),
  huid: z.string().max(50).optional().nullable(),
  metalType: z.enum(['fine', 'roopu', 'silver', 'gold', 'other']).optional(),
  purity: numLike,
  finePercent: numLike,
  grossWeight: numLike,
  netWeight: numLike,
  wastage: numLike,
  makingCharge: numLike,
  labourCharge: numLike,
  otherCharge: numLike,
  saleRate: numLike,
  purchaseRate: numLike,
  minStock: numLike,
  currentQty: numLike,
  currentNet: numLike,
  currentGross: numLike,
  currentFine: numLike,
  unit: z.string().max(20).optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

const toStr = (v: unknown, fallback = '0') =>
  v != null && String(v) !== '' ? String(v) : fallback;

const toStrOpt = (v: unknown) =>
  v != null && String(v) !== '' ? String(v) : undefined;

function stockFromBody(body: {
  currentNet?: unknown;
  currentQty?: unknown;
  currentFine?: unknown;
  purity?: unknown;
}) {
  // Prefer grams (currentNet); fallback currentQty
  const stockG = parseFloat(String(body.currentNet ?? body.currentQty ?? '0')) || 0;
  const purity = parseFloat(String(body.purity ?? '100')) || 100;
  const fineG =
    body.currentFine != null && String(body.currentFine) !== ''
      ? parseFloat(String(body.currentFine)) || 0
      : (stockG * purity) / 100;
  return {
    currentQty: String(stockG),
    currentNet: String(stockG),
    currentGross: String(stockG),
    currentFine: String(+fineG.toFixed(4)),
  };
}

// ==================== LIST ====================
router.get('/', async (req, res, next) => {
  try {
    const { search, categoryId, status, page = '1', limit = '50' } = req.query as {
      search?: string;
      categoryId?: string;
      status?: string;
      page?: string;
      limit?: string;
    };
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: items.id,
        code: items.code,
        name: items.name,
        categoryId: items.categoryId,
        categoryName: categories.name,
        metalType: items.metalType,
        purity: items.purity,
        saleRate: items.saleRate,
        purchaseRate: items.purchaseRate,
        currentQty: items.currentQty,
        currentGross: items.currentGross,
        currentNet: items.currentNet,
        currentFine: items.currentFine,
        minStock: items.minStock,
        unit: items.unit,
        status: items.status,
        huid: items.huid,
        makingCharge: items.makingCharge,
        notes: items.notes,
      })
      .from(items)
      .leftJoin(categories, eq(items.categoryId, categories.id))
      .$dynamic();

    const conditions = [];
    if (search) {
      const s = `%${search}%`;
      conditions.push(or(ilike(items.name, s), ilike(items.code, s)));
    }
    if (categoryId) conditions.push(eq(items.categoryId, parseInt(categoryId as string, 10)));
    if (status) conditions.push(eq(items.status, status as 'active' | 'inactive'));
    if (conditions.length) {
      query = query.where(sql`${sql.join(conditions, sql` AND `)}`);
    }

    const data = await query.orderBy(desc(items.createdAt)).limit(limitNum).offset(offset);
    res.json({ success: true, data, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
});

// ==================== GET ONE ====================
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    if (!item) throw new AppError('Item not found', 404);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// ==================== CREATE ====================
router.post('/', authorize('items.create', 'items.*'), async (req, res, next) => {
  try {
    const body = itemSchema.parse(req.body);

    let code = body.code;
    if (!code) {
      const [last] = await db
        .select({ code: items.code })
        .from(items)
        .orderBy(desc(items.id))
        .limit(1);
      const nextNum = last ? parseInt(last.code.replace(/\D/g, '') || '0', 10) + 1 : 1;
      code = `S${String(nextNum).padStart(5, '0')}`;
    }

    const stock = stockFromBody(body);

    const [created] = await db
      .insert(items)
      .values({
        code,
        name: body.name,
        categoryId: body.categoryId,
        huid: body.huid ?? null,
        metalType: body.metalType || 'silver',
        purity: toStr(body.purity, '100'),
        finePercent: toStr(body.finePercent, toStr(body.purity, '100')),
        grossWeight: toStr(body.grossWeight, stock.currentNet),
        netWeight: toStr(body.netWeight, stock.currentNet),
        wastage: toStr(body.wastage, '0'),
        makingCharge: toStr(body.makingCharge, '0'),
        labourCharge: toStr(body.labourCharge, '0'),
        otherCharge: toStr(body.otherCharge, '0'),
        saleRate: toStr(body.saleRate ?? body.purchaseRate, '0'),
        purchaseRate: toStr(body.purchaseRate, '0'),
        minStock: toStr(body.minStock, '0'),
        currentQty: stock.currentQty,
        currentGross: stock.currentGross,
        currentNet: stock.currentNet,
        currentFine: stock.currentFine,
        unit: body.unit || 'g',
        notes: body.notes ?? null,
        status: body.status || 'active',
        createdBy: req.user!.id,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// ==================== UPDATE ====================
router.put('/:id', authorize('items.edit', 'items.*'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = itemSchema.partial().parse(req.body);

    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.code != null) patch.code = body.code;
    if (body.name != null) patch.name = body.name;
    if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
    if (body.huid !== undefined) patch.huid = body.huid;
    if (body.metalType != null) patch.metalType = body.metalType;
    if (body.purity != null) patch.purity = toStr(body.purity);
    if (body.finePercent != null) patch.finePercent = toStr(body.finePercent);
    if (body.wastage != null) patch.wastage = toStr(body.wastage);
    if (body.makingCharge != null) patch.makingCharge = toStr(body.makingCharge);
    if (body.labourCharge != null) patch.labourCharge = toStr(body.labourCharge);
    if (body.otherCharge != null) patch.otherCharge = toStr(body.otherCharge);
    if (body.saleRate != null) patch.saleRate = toStr(body.saleRate);
    if (body.purchaseRate != null) patch.purchaseRate = toStr(body.purchaseRate);
    if (body.minStock != null) patch.minStock = toStr(body.minStock);
    if (body.unit != null) patch.unit = body.unit;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.status != null) patch.status = body.status;

    // Stock in grams — update all related columns together
    if (body.currentNet != null || body.currentQty != null || body.currentFine != null) {
      const stock = stockFromBody({
        currentNet: body.currentNet,
        currentQty: body.currentQty,
        currentFine: body.currentFine,
        purity: body.purity,
      });
      patch.currentQty = stock.currentQty;
      patch.currentNet = stock.currentNet;
      patch.currentGross = stock.currentGross;
      patch.currentFine = stock.currentFine;
    }

    const [updated] = await db
      .update(items)
      .set(patch as any)
      .where(eq(items.id, id))
      .returning();

    if (!updated) throw new AppError('Item not found', 404);
    res.json({ success: true, data: updated, message: 'Silver updated' });
  } catch (err) {
    next(err);
  }
});

// ==================== TOGGLE STATUS ====================
router.patch('/:id/status', authorize('items.edit', 'items.*'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: 'active' | 'inactive' };
    if (status !== 'active' && status !== 'inactive') {
      throw new AppError('Status must be active or inactive', 400);
    }

    const [updated] = await db
      .update(items)
      .set({ status, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();

    if (!updated) throw new AppError('Item not found', 404);
    res.json({
      success: true,
      message: status === 'active' ? 'Item activated' : 'Item deactivated',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== DELETE (Soft + Hard) ====================
router.delete('/:id', authorize('items.delete', 'items.*'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const hard = String((req.query as { hard?: string }).hard || '') === 'true';

    if (hard) {
      const [saleCount] = await db
        .select({ count: sql`COUNT(*)`.mapWith(String) })
        .from(saleItems)
        .where(eq(saleItems.itemId, id));
      const count = parseInt(String(saleCount?.count || '0'), 10);

      if (count > 0) {
        throw new AppError(
          `Cannot permanently delete this item. It is used in ${count} sale(s). Use Deactivate instead.`,
          400
        );
      }

      const [deleted] = await db.delete(items).where(eq(items.id, id)).returning();
      if (!deleted) throw new AppError('Item not found', 404);
      return res.json({ success: true, message: 'Item permanently deleted' });
    }

    const [updated] = await db
      .update(items)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();

    if (!updated) throw new AppError('Item not found', 404);
    res.json({ success: true, message: 'Item deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;
