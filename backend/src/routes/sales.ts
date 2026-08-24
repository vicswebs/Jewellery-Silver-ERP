import { Router } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { db } from '../db/index.js';
import {
  sales,
  saleItems,
  items,
  customers,
  ledgerEntries,
  stockMovements,
  invoiceSequences,
} from '../db/schema.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

const SALE_STATUS = z.enum(['draft', 'confirmed', 'cancelled']);

const saleItemSchema = z.object({
  itemId: z.number().int(),
  quantity: z.union([z.string(), z.number()]).default(1),
  grossWeight: z.union([z.string(), z.number()]),
  bagWeight: z.union([z.string(), z.number()]).optional().default(0),
  stoneWeight: z.union([z.string(), z.number()]).optional(),
  netWeight: z.union([z.string(), z.number()]),
  purity: z.union([z.string(), z.number()]).optional(),
  wastage: z.union([z.string(), z.number()]).optional().default(0),
  fineWeight: z.union([z.string(), z.number()]).optional(),
  rate: z.union([z.string(), z.number()]),
  makingCharge: z.union([z.string(), z.number()]).optional(),
  labourCharge: z.union([z.string(), z.number()]).optional(),
  otherCharge: z.union([z.string(), z.number()]).optional(),
  discount: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]),
  notes: z.string().optional().nullable(),
});

const saleSchema = z.object({
  invoiceDate: z.string(),
  customerId: z.number().int(),
  salespersonId: z.number().int().optional().nullable(),
  items: z.array(saleItemSchema).min(1),
  discount: z.union([z.string(), z.number()]).optional().default(0),
  taxAmount: z.union([z.string(), z.number()]).optional().default(0),
  parcelCharge: z.union([z.string(), z.number()]).optional().default(0),
  kasar: z.union([z.string(), z.number()]).optional().default(0),
  paidAmount: z.union([z.string(), z.number()]).optional().default(0),
  paymentMode: z
    .enum(['cash', 'bank', 'fine', 'roopu', 'adjustment', 'rtgs', 'upi', 'cheque'])
    .optional(),
  notes: z.string().optional().nullable(),
  receivedSilver: z
    .object({
      weight: z.union([z.string(), z.number()]).optional().default(0),
      purity: z.union([z.string(), z.number()]).optional().default(0),
      fine: z.union([z.string(), z.number()]).optional().default(0),
    })
    .optional(),
  rateCut: z
    .object({
      fine: z.union([z.string(), z.number()]).optional().default(0),
      rate: z.union([z.string(), z.number()]).optional().default(0),
      amount: z.union([z.string(), z.number()]).optional().default(0),
    })
    .optional(),
});

const updateSaleSchema = z.object({
  status: SALE_STATUS.optional(),
  paidAmount: z.union([z.string(), z.number()]).optional(),
  dueAmount: z.union([z.string(), z.number()]).optional(),
  receivedFine: z.union([z.string(), z.number()]).optional(),
  fineBalance: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional().nullable(),
});

const toNum = (v: any) => parseFloat(String(v || 0)) || 0;

async function getCompanyName(req?: { query?: any }): Promise<{
  name: string;
  phone: string;
  address: string;
  gstin: string;
}> {
  const fallback = {
    name: process.env.APP_NAME || process.env.COMPANY_NAME || 'Ritik Chains',
    phone: process.env.COMPANY_PHONE || '',
    address: process.env.COMPANY_ADDRESS || '',
    gstin: process.env.COMPANY_GSTIN || '',
  };
  const qName = req?.query?.companyName
    ? String(req.query.companyName).trim()
    : '';
  if (qName) {
    return {
      ...fallback,
      name: qName,
      phone: req?.query?.phone ? String(req.query.phone) : fallback.phone,
      address: req?.query?.address ? String(req.query.address) : fallback.address,
      gstin: req?.query?.gstin ? String(req.query.gstin) : fallback.gstin,
    };
  }
  try {
    const r: any = await db.execute(sql`
      SELECT key, value FROM settings
      WHERE key IN ('companyName', 'phone', 'address', 'gstin')
    `);
    const rows = (r.rows || r) as Array<{ key: string; value: string }>;
    if (Array.isArray(rows) && rows.length) {
      const map: Record<string, string> = {};
      for (const row of rows) map[row.key] = String(row.value || '');
      return {
        name: map.companyName || fallback.name,
        phone: map.phone || fallback.phone,
        address: map.address || fallback.address,
        gstin: map.gstin || fallback.gstin,
      };
    }
  } catch {
    /* no settings table */
  }
  return fallback;
}

async function nextInvoiceNo(prefix: string): Promise<string> {
  const [seq] = await db
    .select()
    .from(invoiceSequences)
    .where(eq(invoiceSequences.prefix, prefix))
    .limit(1);
  if (!seq) {
    await db.insert(invoiceSequences).values({ prefix, currentNumber: 1, padding: 6 });
    return prefix + String(1).padStart(6, '0');
  }
  const next = (seq.currentNumber || 0) + 1;
  await db
    .update(invoiceSequences)
    .set({ currentNumber: next })
    .where(eq(invoiceSequences.id, seq.id));
  return prefix + String(next).padStart(seq.padding || 6, '0');
}

// LIST
router.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '50' } = req.query as {
      page?: string;
      limit?: string;
    };
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const data = await db
      .select({
        id: sales.id,
        invoiceNo: sales.invoiceNo,
        invoiceDate: sales.invoiceDate,
        customerId: sales.customerId,
        customerName: customers.name,
        customerMobile: customers.mobile,
        grandTotal: sales.grandTotal,
        paidAmount: sales.paidAmount,
        dueAmount: sales.dueAmount,
        totalFine: sales.totalFine,
        receivedFine: sales.receivedFine,
        fineBalance: sales.fineBalance,
        notes: sales.notes,
        status: sales.status,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .orderBy(desc(sales.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PDF
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [sale] = await db
      .select({
        id: sales.id,
        invoiceNo: sales.invoiceNo,
        invoiceDate: sales.invoiceDate,
        grandTotal: sales.grandTotal,
        paidAmount: sales.paidAmount,
        dueAmount: sales.dueAmount,
        totalFine: sales.totalFine,
        status: sales.status,
        customerName: customers.name,
        customerMobile: customers.mobile,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(eq(sales.id, id))
      .limit(1);

    if (!sale) throw new AppError('Sale not found', 404);

    const lines = await db
      .select({
        itemName: items.name,
        quantity: saleItems.quantity,
        grossWeight: saleItems.grossWeight,
        netWeight: saleItems.netWeight,
        purity: saleItems.purity,
        wastage: saleItems.wastage,
        fineWeight: saleItems.fineWeight,
        rate: saleItems.rate,
        amount: saleItems.amount,
      })
      .from(saleItems)
      .leftJoin(items, eq(saleItems.itemId, items.id))
      .where(eq(saleItems.saleId, id));

    const company = await getCompanyName(req);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Invoice-${sale.invoiceNo}.pdf`
    );
    doc.pipe(res);

    doc.fontSize(20).text(company.name, { align: 'center' });
    doc.fontSize(11).text('Silver Sales Invoice', { align: 'center' });
    if (company.address) {
      doc.fontSize(9).text(company.address, { align: 'center' });
    }
    if (company.phone || company.gstin) {
      doc.fontSize(9).text(
        [
          company.phone ? `Ph: ${company.phone}` : '',
          company.gstin ? `GSTIN: ${company.gstin}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        { align: 'center' }
      );
    }
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Invoice No : ${sale.invoiceNo}`);
    doc.text(`Date : ${sale.invoiceDate}`);
    doc.text(`Customer : ${sale.customerName || '-'}`);
    if (sale.customerMobile) doc.text(`Mobile : ${sale.customerMobile}`);
    doc.moveDown();

    const startY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Item', 40, startY);
    doc.text('Gross', 200, startY);
    doc.text('Tunch', 260, startY);
    doc.text('Wast', 320, startY);
    doc.text('Fine', 380, startY);
    doc.text('Amount', 450, startY, { width: 80, align: 'right' });
    doc.moveTo(40, startY + 14).lineTo(550, startY + 14).stroke();

    let y = startY + 22;
    doc.font('Helvetica').fontSize(9);
    for (const line of lines) {
      doc.text(String(line.itemName || 'Silver'), 40, y, { width: 150 });
      doc.text(String(line.grossWeight || line.netWeight || 0), 200, y);
      doc.text(String(line.purity || 0) + '%', 260, y);
      doc.text(String(line.wastage || 0) + '%', 320, y);
      doc.text(String(line.fineWeight || 0), 380, y);
      doc.text('₹ ' + Number(line.amount || 0).toLocaleString('en-IN'), 450, y, {
        width: 80,
        align: 'right',
      });
      y += 18;
    }

    doc.moveDown(2);
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Total Fine : ${Number(sale.totalFine || 0).toFixed(4)} g`);
    doc.text(
      `Grand Total : ₹ ${Number(sale.grandTotal || 0).toLocaleString('en-IN')}`
    );
    doc.text(
      `Paid Amount : ₹ ${Number(sale.paidAmount || 0).toLocaleString('en-IN')}`
    );
    doc.text(
      `Due Amount : ₹ ${Number(sale.dueAmount || 0).toLocaleString('en-IN')}`
    );
    doc.text(`Status : ${sale.status}`);

    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica').text('Thank you for your business!', {
      align: 'center',
    });
    doc.end();
  } catch (err) {
    next(err);
  }
});

// GET ONE
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [sale] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
    if (!sale) throw new AppError('Sale not found', 404);
    const lines = await db.select().from(saleItems).where(eq(saleItems.saleId, id));
    res.json({ success: true, data: { ...sale, items: lines } });
  } catch (err) {
    next(err);
  }
});

// UPDATE
router.patch(
  '/:id',
  authorize('sales.update', 'sales.edit', 'sales.*'),
  async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id, 10);
      const body = updateSaleSchema.parse(req.body);
      const [existing] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
      if (!existing) throw new AppError('Sale not found', 404);

      let status = body.status;
      if (status === ('partial' as any) || status === ('paid' as any)) {
        status = 'confirmed';
      }
      if (status && !['draft', 'confirmed', 'cancelled'].includes(status)) {
        throw new AppError(
          'Invalid status. Allowed: draft, confirmed, cancelled',
          400
        );
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (status !== undefined) updateData.status = status;
      if (body.paidAmount !== undefined) {
        updateData.paidAmount = String(Math.max(0, toNum(body.paidAmount)));
      }
      if (body.dueAmount !== undefined) {
        updateData.dueAmount = String(Math.max(0, toNum(body.dueAmount)));
      }
      if (body.receivedFine !== undefined) {
        updateData.receivedFine = String(toNum(body.receivedFine));
      }
      if (body.fineBalance !== undefined) {
        updateData.fineBalance = String(toNum(body.fineBalance));
      }
      if (body.notes !== undefined) {
        updateData.notes = body.notes;
      }

      if (body.paidAmount !== undefined && body.dueAmount === undefined) {
        const grand = toNum(existing.grandTotal);
        const paid = Math.max(0, toNum(body.paidAmount));
        updateData.paidAmount = String(paid);
        updateData.dueAmount = String(Math.max(0, +(grand - paid).toFixed(2)));
      }

      const [updated] = await db
        .update(sales)
        .set(updateData as any)
        .where(eq(sales.id, id))
        .returning();

      res.json({ success: true, message: 'Sale updated', data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// CREATE SALE
router.post('/', authorize('sales.create', 'sales.*'), async (req, res, next) => {
  try {
    const body = saleSchema.parse(req.body);

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, body.customerId))
      .limit(1);
    if (!customer) throw new AppError('Customer not found', 404);

    let totalGross = 0;
    let totalNet = 0;
    let totalFine = 0;
    let totalMaking = 0;
    let totalOther = 0;
    let itemsTotal = 0;

    for (const line of body.items) {
      totalGross += toNum(line.grossWeight);
      totalNet += toNum(line.netWeight);
      totalFine += toNum(line.fineWeight);
      totalMaking += toNum(line.makingCharge);
      totalOther += toNum(line.otherCharge) + toNum(line.labourCharge);
      itemsTotal += toNum(line.amount);
    }

    const discount = toNum(body.discount);
    const taxAmount = toNum(body.taxAmount);
    const parcelCharge = toNum(body.parcelCharge);
    const kasar = toNum(body.kasar);
    const paidAmount = toNum(body.paidAmount);
    const rateCutAmount = toNum(body.rateCut?.amount);
    const receivedFine = toNum(body.receivedSilver?.fine);

    const grandTotal = itemsTotal + parcelCharge - discount - rateCutAmount + taxAmount;
    const dueAmount = Math.max(0, grandTotal - paidAmount - kasar);
    const fineBalance = totalFine - receivedFine;

    const invoiceNo = await nextInvoiceNo('SALE-');

    const result = await db.transaction(async (tx) => {
      const [sale] = await tx
        .insert(sales)
        .values({
          invoiceNo,
          invoiceDate: body.invoiceDate,
          customerId: body.customerId,
          salespersonId: body.salespersonId || req.user!.id,
          totalGross: String(totalGross),
          totalNet: String(totalNet),
          totalFine: String(totalFine),
          totalMaking: String(totalMaking),
          totalOther: String(totalOther),
          discount: String(discount),
          taxAmount: String(taxAmount),
          parcelCharge: String(parcelCharge),
          kasar: String(kasar),
          rateCutAmount: String(rateCutAmount),
          receivedFine: String(receivedFine),
          fineBalance: String(fineBalance),
          grandTotal: String(grandTotal),
          paidAmount: String(paidAmount),
          dueAmount: String(dueAmount),
          paymentMode: body.paymentMode,
          notes: body.notes,
          status: 'confirmed',
          createdBy: req.user!.id,
        })
        .returning();

      for (const line of body.items) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          itemId: line.itemId,
          quantity: String(line.quantity || 1),
          grossWeight: String(line.grossWeight),
          bagWeight: String(line.bagWeight || 0),
          stoneWeight: String(line.stoneWeight || 0),
          netWeight: String(line.netWeight),
          purity: String(line.purity || 0),
          wastage: String(line.wastage || 0),
          fineWeight: String(line.fineWeight || 0),
          rate: String(line.rate),
          makingCharge: String(line.makingCharge || 0),
          labourCharge: String(line.labourCharge || 0),
          otherCharge: String(line.otherCharge || 0),
          discount: String(line.discount || 0),
          amount: String(line.amount),
          notes: line.notes,
        });

        await tx
          .update(items)
          .set({
            currentQty: sql`${items.currentQty} - ${String(line.quantity || 1)}`,
            currentGross: sql`${items.currentGross} - ${String(line.grossWeight)}`,
            currentNet: sql`${items.currentNet} - ${String(line.netWeight)}`,
            currentFine: sql`${items.currentFine} - ${String(line.fineWeight || 0)}`,
            updatedAt: new Date(),
          })
          .where(eq(items.id, line.itemId));

        await tx.insert(stockMovements).values({
          movementDate: body.invoiceDate,
          itemId: line.itemId,
          movementType: 'sale',
          referenceType: 'sale',
          referenceId: sale.id,
          quantityOut: String(line.quantity || 1),
          grossOut: String(line.grossWeight),
          netOut: String(line.netWeight),
          fineOut: String(line.fineWeight || 0),
          createdBy: req.user!.id,
        });
      }

      await tx.insert(ledgerEntries).values({
        entryDate: body.invoiceDate,
        partyType: 'customer',
        partyId: body.customerId,
        ledgerType: 'sale',
        referenceType: 'sale',
        referenceId: sale.id,
        referenceNo: invoiceNo,
        debit: String(grandTotal),
        credit: '0',
        fineDebit: String(totalFine),
        fineCredit: '0',
        narration: `Sale ${invoiceNo}`,
        createdBy: req.user!.id,
      });

      if (receivedFine > 0) {
        await tx.insert(ledgerEntries).values({
          entryDate: body.invoiceDate,
          partyType: 'customer',
          partyId: body.customerId,
          ledgerType: 'received_fine',
          referenceType: 'sale',
          referenceId: sale.id,
          referenceNo: invoiceNo,
          debit: '0',
          credit: '0',
          fineDebit: '0',
          fineCredit: String(receivedFine),
          narration: `Received Fine against ${invoiceNo}`,
          createdBy: req.user!.id,
        });
      }

      if (rateCutAmount > 0) {
        await tx.insert(ledgerEntries).values({
          entryDate: body.invoiceDate,
          partyType: 'customer',
          partyId: body.customerId,
          ledgerType: 'rate_cut',
          referenceType: 'sale',
          referenceId: sale.id,
          referenceNo: invoiceNo,
          debit: '0',
          credit: String(rateCutAmount),
          fineDebit: String(body.rateCut?.fine || 0),
          fineCredit: '0',
          narration: `Rate Cut ${body.rateCut?.fine}g @ ${body.rateCut?.rate} - ${invoiceNo}`,
          createdBy: req.user!.id,
        });
      }

      if (paidAmount > 0) {
        await tx.insert(ledgerEntries).values({
          entryDate: body.invoiceDate,
          partyType: 'customer',
          partyId: body.customerId,
          ledgerType: 'receipt',
          referenceType: 'sale',
          referenceId: sale.id,
          referenceNo: invoiceNo,
          debit: '0',
          credit: String(paidAmount),
          fineDebit: '0',
          fineCredit: '0',
          narration: `Payment against ${invoiceNo}`,
          createdBy: req.user!.id,
        });
      }

      if (kasar > 0) {
        await tx.insert(ledgerEntries).values({
          entryDate: body.invoiceDate,
          partyType: 'customer',
          partyId: body.customerId,
          ledgerType: 'adjustment',
          referenceType: 'sale',
          referenceId: sale.id,
          referenceNo: invoiceNo,
          debit: '0',
          credit: String(kasar),
          fineDebit: '0',
          fineCredit: '0',
          narration: `Kasar against ${invoiceNo}`,
          createdBy: req.user!.id,
        });
      }

      return sale;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
