import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

/**
 * POST /api/reset/business
 * Clears sales, purchases, stock movements, ledger, silver txns, etc.
 * Keeps: users, settings (optional).
 * Body: { confirm: "RESET" }
 */
router.post(
  '/business',
  authorize('settings.*', 'admin', 'users.*'),
  async (req, res, next) => {
    try {
      if (String(req.body?.confirm || '') !== 'RESET') {
        throw new AppError('Type confirm: "RESET" to proceed', 400);
      }

      // Order matters because of foreign keys
      await db.transaction(async (tx) => {
        const run = async (q: string) => {
          try {
            await tx.execute(sql.raw(q));
          } catch {
            // table may not exist in some installs — skip
          }
        };

        await run(`TRUNCATE TABLE sale_items RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE sales RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE purchase_items RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE purchases RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE stock_movements RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE ledger_entries RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE payments RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE receipts RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE silver_txns RESTART IDENTITY CASCADE`);
        await run(`TRUNCATE TABLE invoice_sequences RESTART IDENTITY CASCADE`);

        // Optional: clear party & item masters for full empty test
        if (req.body?.clearMasters === true) {
          await run(`TRUNCATE TABLE customers RESTART IDENTITY CASCADE`);
          await run(`TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE`);
          await run(`TRUNCATE TABLE items RESTART IDENTITY CASCADE`);
          await run(`TRUNCATE TABLE categories RESTART IDENTITY CASCADE`);
        } else {
          // Reset stock qty to 0 but keep item names
          await run(`
            UPDATE items SET
              current_qty = '0',
              current_net = '0',
              current_gross = '0',
              current_fine = '0',
              updated_at = NOW()
          `);
        }
      });

      res.json({
        success: true,
        message:
          req.body?.clearMasters === true
            ? 'All business data + masters cleared. Users kept.'
            : 'Transactions cleared. Masters kept; item stock set to 0.',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;