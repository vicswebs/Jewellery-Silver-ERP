# Ritik Chains — Setup Guide

**Developed by ToolClub.website**

## 1. Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- Git (optional)

## 2. Database Setup

```bash
# Create database
createdb ritik_chains

# Or via psql:
# CREATE DATABASE ritik_chains;
```

## 3. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/ritik_chains
JWT_SECRET=generate-a-long-random-string-here
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

## 4. Install & Migrate

From project root:

```bash
npm install
cd backend
npx drizzle-kit generate
npm run db:migrate
npm run db:seed
cd ..
```

## 5. Run Development

```bash
# Terminal 1 – Backend
npm run dev:backend

# Terminal 2 – Frontend
npm run dev:frontend
```

Open http://localhost:5173

**Login:** `admin` / `admin123`

## 6. What Works Out of the Box

| Module          | Status                                      |
|-----------------|---------------------------------------------|
| Login / Auth    | ✅ Full JWT + roles                         |
| Customers       | ✅ List, Search, Create, Deactivate         |
| Items           | ✅ List, Search, Create                     |
| New Sale        | ✅ Full transaction + stock + ledger        |
| Sales List      | ✅                                          |
| Stock View      | ✅                                          |
| Dashboard       | ✅ Quick actions                            |
| Database Schema | ✅ Complete for all major modules           |
| Sales Atomic TX | ✅ Invoice + stock + ledger in one TX       |

## 7. Next Development Steps

The database schema already includes tables for:

- Suppliers, Bullions
- Purchases & Purchase Returns
- Sales Returns
- Payments / Receipts
- Rate management & Price lists
- Customer-item rates
- Ledger entries, Stock movements
- Cash / Bank accounts
- Reminders, Activity logs
- Invoice sequences

Implement remaining API routes following the pattern in `customers.ts`, `items.ts` and `sales.ts`.

## 8. Electron Desktop

```bash
# Start backend + frontend first, then:
cd electron
npm install
npm run dev
```

## 9. Production Notes

- Change default admin password immediately
- Use strong JWT_SECRET
- Configure proper PostgreSQL credentials
- For LAN: point frontend API URL to server IP
- Backup: use `pg_dump` or implement `/api/backups`

---

Ritik Chains ERP — ToolClub.website
