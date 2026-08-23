import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { customers } from '../db/schema.js';

const router = Router();

// Public test — no login
router.get('/ping', (_req, res) => {
  res.json({ success: true, message: 'silver module ok' });
});

router.use(authenticate);

const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;

function calcFine(gross: number, purity: number) {
  return Math.round(((gross * purity) / 100) * 1000) / 1000;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function nextTxnNo(prefix: string) {
  try {
    const result: any = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM silver_txns WHERE txn_no LIKE ${prefix + '%'}
    `);
    const rows = result.rows || result;
    const count = Number(rows?.[0]?.c ?? 0) + 1;
    return `${prefix}${String(count).padStart(6, '0')}`;
  } catch {
    return `${prefix}${Date.now().toString().slice(-6)}`;
  }
}

// List transactions
router.get('/txns', async (req, res, next) => {
  try {
    const partyType = req.query.partyType ? String(req.query.partyType) : null;
    const partyId = req.query.partyId ? parseInt(String(req.query.partyId), 10) : null;
    const txnType = req.query.txnType ? String(req.query.txnType) : null;

    let query = sql`
      SELECT * FROM silver_txns
      WHERE status = 'confirmed'
    `;
    if (partyType) query = sql`${query} AND party_type = ${partyType}`;
    if (partyId) query = sql`${query} AND party_id = ${partyId}`;
    if (txnType) query = sql`${query} AND txn_type = ${txnType}`;
    query = sql`${query} ORDER BY txn_date DESC, id DESC LIMIT 200`;

    const result: any = await db.execute(query);
    const rows = result.rows || result;
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// Party fine balance
router.get('/balance/:partyType/:partyId', async (req, res, next) => {
  try {
    const partyType = String(req.params.partyType);
    const partyId = parseInt(req.params.partyId, 10);

    const result: any = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE
          WHEN txn_type IN ('deposit','adjust') THEN fine_wt
          WHEN txn_type IN ('issue','sell') THEN -fine_wt
          WHEN txn_type = 'palta' AND settle_mode = 'fine' THEN -fine_wt
          ELSE 0
        END), 0)::text AS fine_balance,
        COALESCE(SUM(CASE
          WHEN txn_type IN ('deposit') THEN amount
          WHEN txn_type IN ('issue','sell') THEN -amount
          WHEN txn_type = 'palta' AND settle_mode IN ('cash','bank') THEN -amount
          ELSE 0
        END), 0)::text AS amount_balance,
        COALESCE(SUM(CASE WHEN txn_type = 'deposit' THEN fine_wt ELSE 0 END), 0)::text AS total_deposit_fine,
        COALESCE(SUM(CASE WHEN txn_type IN ('issue','sell') THEN fine_wt ELSE 0 END), 0)::text AS total_issue_fine
      FROM silver_txns
      WHERE party_type = ${partyType}
        AND party_id = ${partyId}
        AND status = 'confirmed'
    `);

    const rows = result.rows || result;
    const r = rows?.[0] || {};
    res.json({
      success: true,
      data: {
        partyType,
        partyId,
        fineBalance: num(r.fine_balance),
        amountBalance: num(r.amount_balance),
        totalDepositFine: num(r.total_deposit_fine),
        totalIssueFine: num(r.total_issue_fine),
      },
    });
  } catch (err) {
    next(err);
  }
});

// DEPOSIT
router.post('/deposit', async (req, res, next) => {
  try {
    const {
      partyType = 'customer',
      partyId,
      partyName,
      txnDate,
      grossWt,
      purity = 100,
      rate = 0,
      notes,
    } = req.body;

    if (!partyId) {
      return res.status(400).json({ success: false, message: 'Party required' });
    }
    const gross = num(grossWt);
    const pur = num(purity) || 100;
    if (gross <= 0) {
      return res.status(400).json({ success: false, message: 'Gross weight required' });
    }

    const fine = calcFine(gross, pur);
    const rt = num(rate);
    const amount = Math.round(fine * rt * 100) / 100;
    const txnNo = await nextTxnNo('DEP-');
    const userId = (req as any).user?.id || null;

    await db.execute(sql`
      INSERT INTO silver_txns (
        txn_no, txn_type, txn_date, party_type, party_id, party_name,
        gross_wt, purity, fine_wt, rate, amount, notes, status, created_by
      ) VALUES (
        ${txnNo}, 'deposit', ${txnDate || today()}, ${partyType}, ${partyId}, ${partyName || null},
        ${gross}, ${pur}, ${fine}, ${rt}, ${amount}, ${notes || null}, 'confirmed',
        ${userId}
      )
    `);

    res.status(201).json({
      success: true,
      message: 'Silver deposit saved',
      data: { txnNo, fine, amount },
    });
  } catch (err) {
    next(err);
  }
});

// SELL
router.post('/sell', async (req, res, next) => {
  try {
    const {
      partyType = 'customer',
      partyId,
      partyName,
      txnDate,
      grossWt,
      purity = 100,
      rate = 0,
      notes,
    } = req.body;

    if (!partyId) {
      return res.status(400).json({ success: false, message: 'Party required' });
    }
    const gross = num(grossWt);
    const pur = num(purity) || 100;
    if (gross <= 0) {
      return res.status(400).json({ success: false, message: 'Gross weight required' });
    }

    const fine = calcFine(gross, pur);
    const rt = num(rate);
    const amount = Math.round(fine * rt * 100) / 100;
    const txnNo = await nextTxnNo('SIL-');
    const userId = (req as any).user?.id || null;

    await db.execute(sql`
      INSERT INTO silver_txns (
        txn_no, txn_type, txn_date, party_type, party_id, party_name,
        gross_wt, purity, fine_wt, rate, amount, notes, status, created_by
      ) VALUES (
        ${txnNo}, 'sell', ${txnDate || today()}, ${partyType}, ${partyId}, ${partyName || null},
        ${gross}, ${pur}, ${fine}, ${rt}, ${amount}, ${notes || null}, 'confirmed',
        ${userId}
      )
    `);

    res.status(201).json({
      success: true,
      message: 'Silver sell saved',
      data: { txnNo, fine, amount },
    });
  } catch (err) {
    next(err);
  }
});

// PALTA
router.post('/palta', async (req, res, next) => {
  try {
    const {
      partyType = 'customer',
      partyId,
      partyName,
      txnDate,
      fineWt,
      oldRate,
      newRate,
      settleMode = 'cash',
      notes,
    } = req.body;

    if (!partyId) {
      return res.status(400).json({ success: false, message: 'Party required' });
    }
    const fine = num(fineWt);
    const oldR = num(oldRate);
    const newR = num(newRate);
    if (fine <= 0) {
      return res.status(400).json({ success: false, message: 'Fine weight required' });
    }
    if (oldR <= 0 || newR <= 0) {
      return res.status(400).json({ success: false, message: 'Old and new rate required' });
    }

    const rateDiff = Math.round((newR - oldR) * 100) / 100;
    const amount = Math.round(fine * rateDiff * 100) / 100;
    const txnNo = await nextTxnNo('PLT-');
    const userId = (req as any).user?.id || null;

    await db.execute(sql`
      INSERT INTO silver_txns (
        txn_no, txn_type, txn_date, party_type, party_id, party_name,
        gross_wt, purity, fine_wt, rate, amount,
        old_rate, new_rate, rate_diff, settle_mode,
        notes, status, created_by
      ) VALUES (
        ${txnNo}, 'palta', ${txnDate || today()}, ${partyType}, ${partyId}, ${partyName || null},
        ${fine}, 100, ${fine}, ${newR}, ${amount},
        ${oldR}, ${newR}, ${rateDiff}, ${settleMode},
        ${notes || null}, 'confirmed', ${userId}
      )
    `);

    res.status(201).json({
      success: true,
      message: 'Palta saved',
      data: { txnNo, fine, rateDiff, amount, settleMode },
    });
  } catch (err) {
    next(err);
  }
});

// Customers for dropdown (id + name only — safe)
router.get('/parties/customers', async (_req, res, next) => {
  try {
    const list = await db
      .select({
        id: customers.id,
        name: customers.name,
      })
      .from(customers)
      .where(eq(customers.status, 'active'))
      .orderBy(customers.name)
      .limit(500);

    res.json({
      success: true,
      data: list.map((p) => ({ ...p, code: null as string | null })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;