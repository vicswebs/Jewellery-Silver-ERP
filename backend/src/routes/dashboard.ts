import { Router } from 'express';
import { eq, sql, desc, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  sales,
  purchases,
  customers,
  cashAccounts,
  bankAccounts,
  rates,
} from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const num = (v: string | null | undefined | number) => parseFloat(String(v ?? 0)) || 0;

let marketCache: { at: number; data: any } | null = null;
const MARKET_TTL_MS = 5 * 60 * 1000;

function periodRange(
  period: string,
  year?: number,
  month?: number
): { from: string | null; to: string | null; label: string } {
  const now = new Date();
  const toToday = todayStr();

  if (period === 'today') {
    return { from: toToday, to: toToday, label: 'Today' };
  }

  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    return { from, to: toToday, label: 'This Month' };
  }

  if (period === 'year') {
    const from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    return { from, to: toToday, label: 'This Year' };
  }

  if (period === 'custom' && year && month && month >= 1 && month <= 12) {
    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0);
    const from = fromDate.toISOString().slice(0, 10);
    const to = toDate.toISOString().slice(0, 10);
    const label = fromDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    return { from, to, label };
  }

  if (period === 'custom_year' && year) {
    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: `Year ${year}`,
    };
  }

  return { from: null, to: null, label: 'Lifetime' };
}

async function fetchSilverMarket() {
  if (marketCache && Date.now() - marketCache.at < MARKET_TTL_MS) {
    return { ...marketCache.data, cached: true };
  }

  let usdPerOz = 0;
  let inrPerOz = 0;
  let inrPerGram = 0;
  let changePercent: number | null = null;
  let source = 'fallback';

  try {
    const res = await fetch('https://api.gold-api.com/price/XAG', {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json: any = await res.json();
      usdPerOz = num(json?.price) || num(json?.ask) || num(json?.bid) || 0;
      if (usdPerOz > 0) source = 'gold-api.com';
    }
  } catch (e) {
    console.error('Silver price fetch failed:', e);
  }

  let usdInr = 95.5;
  try {
    const fx = await fetch('https://api.exchangerate.fun/latest?base=USD', {
      signal: AbortSignal.timeout(8000),
    });
    if (fx.ok) {
      const fxJson: any = await fx.json();
      if (fxJson?.rates?.INR) usdInr = num(fxJson.rates.INR);
    }
  } catch (e) {
    console.error('FX fetch failed:', e);
  }

  if (usdPerOz > 0) {
    inrPerOz = usdPerOz * usdInr;
    inrPerGram = inrPerOz / 31.1035;
  }

  if (inrPerGram <= 0) {
    try {
      const [row] = await db
        .select()
        .from(rates)
        .where(eq(rates.metalType, 'silver'))
        .orderBy(desc(rates.effectiveFrom))
        .limit(1);
      if (row) {
        inrPerGram = num(row.sellRate) || num(row.buyRate);
        source = 'local_rates';
      }
    } catch {
      // ignore
    }
  }

  let history: { label: string; buy: number; sell: number }[] = [];
  try {
    const hist = await db
      .select({
        buyRate: rates.buyRate,
        sellRate: rates.sellRate,
        effectiveFrom: rates.effectiveFrom,
      })
      .from(rates)
      .where(eq(rates.metalType, 'silver'))
      .orderBy(desc(rates.effectiveFrom))
      .limit(12);

    history = hist
      .slice()
      .reverse()
      .map((h) => ({
        label: h.effectiveFrom
          ? new Date(h.effectiveFrom).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
            })
          : '',
        buy: num(h.buyRate),
        sell: num(h.sellRate),
      }));
  } catch {
    history = [];
  }

  if (history.length === 0 && inrPerGram > 0) {
    const base = inrPerGram;
    history = [0.97, 0.98, 0.985, 0.99, 0.995, 1.0, 1.005, 1.0].map((f, i) => ({
      label: `T-${7 - i}`,
      buy: Math.round(base * f * 0.995 * 100) / 100,
      sell: Math.round(base * f * 100) / 100,
    }));
    history[history.length - 1] = {
      label: 'Live',
      buy: Math.round(base * 0.995 * 100) / 100,
      sell: Math.round(base * 100) / 100,
    };
  } else if (inrPerGram > 0) {
    history.push({
      label: 'Live',
      buy: Math.round(inrPerGram * 0.995 * 100) / 100,
      sell: Math.round(inrPerGram * 100) / 100,
    });
  }

  const data = {
    silver: {
      usdPerOz: Math.round(usdPerOz * 100) / 100,
      inrPerOz: Math.round(inrPerOz * 100) / 100,
      inrPerGram: Math.round(inrPerGram * 100) / 100,
      changePercent,
      usdInr: Math.round(usdInr * 100) / 100,
      source,
      updatedAt: new Date().toISOString(),
    },
    history,
    cached: false,
    nextRefreshSec: MARKET_TTL_MS / 1000,
  };

  marketCache = { at: Date.now(), data };
  return data;
}

router.get('/', async (req, res, next) => {
  try {
    const today = todayStr();
    const period = String(req.query.period || 'lifetime').toLowerCase();
    const yearQ = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    const monthQ = req.query.month ? parseInt(String(req.query.month), 10) : undefined;

    const range = periodRange(period, yearQ, monthQ);
    const { from, to, label: periodLabel } = range;

    const [todaySalesRow] = await db
      .select({
        total: sql`COALESCE(SUM(${sales.grandTotal}), 0)`.mapWith(String),
        count: sql`COUNT(*)`.mapWith(String),
        paid: sql`COALESCE(SUM(${sales.paidAmount}), 0)`.mapWith(String),
      })
      .from(sales)
      .where(and(eq(sales.invoiceDate, today), eq(sales.status, 'confirmed')));

    const [todayPurchaseRow] = await db
      .select({
        total: sql`COALESCE(SUM(${purchases.grandTotal}), 0)`.mapWith(String),
        count: sql`COUNT(*)`.mapWith(String),
      })
      .from(purchases)
      .where(and(eq(purchases.invoiceDate, today), eq(purchases.status, 'confirmed')));

    const [outstandingRow] = await db
      .select({
        total: sql`COALESCE(SUM(${sales.dueAmount}), 0)`.mapWith(String),
      })
      .from(sales)
      .where(eq(sales.status, 'confirmed'));

    const [cashRow] = await db
      .select({
        total: sql`COALESCE(SUM(${cashAccounts.currentBalance}), 0)`.mapWith(String),
      })
      .from(cashAccounts)
      .where(eq(cashAccounts.status, 'active'));

    const [bankRow] = await db
      .select({
        total: sql`COALESCE(SUM(${bankAccounts.currentBalance}), 0)`.mapWith(String),
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.status, 'active'));

    const [custRow] = await db
      .select({
        count: sql`COUNT(*)`.mapWith(String),
      })
      .from(customers)
      .where(eq(customers.status, 'active'));

    const saleConds = [eq(sales.status, 'confirmed')];
    const purchaseConds = [eq(purchases.status, 'confirmed')];
    if (from) {
      saleConds.push(gte(sales.invoiceDate, from));
      purchaseConds.push(gte(purchases.invoiceDate, from));
    }
    if (to) {
      saleConds.push(lte(sales.invoiceDate, to));
      purchaseConds.push(lte(purchases.invoiceDate, to));
    }

    const [allSales] = await db
      .select({
        total: sql`COALESCE(SUM(${sales.grandTotal}), 0)`.mapWith(String),
        count: sql`COUNT(*)`.mapWith(String),
      })
      .from(sales)
      .where(and(...saleConds));

    const [allPurchases] = await db
      .select({
        total: sql`COALESCE(SUM(${purchases.grandTotal}), 0)`.mapWith(String),
        count: sql`COUNT(*)`.mapWith(String),
      })
      .from(purchases)
      .where(and(...purchaseConds));

    const totalSales = num(allSales?.total as string);
    const totalPurchases = num(allPurchases?.total as string);
    const profitLoss = totalSales - totalPurchases;

    const recentSales = await db
      .select({
        id: sales.id,
        invoiceNo: sales.invoiceNo,
        invoiceDate: sales.invoiceDate,
        customerName: customers.name,
        grandTotal: sales.grandTotal,
        dueAmount: sales.dueAmount,
        status: sales.status,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .orderBy(desc(sales.createdAt))
      .limit(8);

    let market = null;
    try {
      market = await fetchSilverMarket();
    } catch (e) {
      console.error('Market error:', e);
      market = null;
    }

    res.json({
      success: true,
      data: {
        today: {
          salesTotal: num(todaySalesRow?.total as string),
          salesCount: parseInt(String(todaySalesRow?.count || '0'), 10),
          salesPaid: num(todaySalesRow?.paid as string),
          purchaseTotal: num(todayPurchaseRow?.total as string),
          purchaseCount: parseInt(String(todayPurchaseRow?.count || '0'), 10),
        },
        outstanding: num(outstandingRow?.total as string),
        cashBalance: num(cashRow?.total as string),
        bankBalance: num(bankRow?.total as string),
        activeCustomers: parseInt(String(custRow?.count || '0'), 10),
        recentSales,
        pnl: {
          period,
          periodLabel,
          year: yearQ || null,
          month: monthQ || null,
          from,
          to,
          totalSales,
          totalPurchases,
          salesCount: parseInt(String(allSales?.count || '0'), 10),
          purchaseCount: parseInt(String(allPurchases?.count || '0'), 10),
          profitLoss,
          isProfit: profitLoss >= 0,
        },
        market,
        asOf: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;