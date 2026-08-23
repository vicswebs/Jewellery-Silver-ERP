# Ritik Chains — Jewellery & Silver ERP

**Developed by ToolClub.website**

Production-ready Jewellery, Silver, Ornament Billing, Inventory & Accounting ERP.

## Features Overview

- Ornament Sales / Purchase / Returns
- Customer, Supplier & Bullion accounts
- Fine Silver & Roopu / Kachcha Silver management
- Stock & Metal books
- Cash / Bank books
- Day Book, Ledgers, Due List
- Rate management & Customer-wise rates
- Multi-user with role-based permissions
- Offline single-PC mode
- LAN multi-user support
- Future cloud/server ready
- Electron Windows desktop application
- Professional printing & export

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React + Vite + Tailwind CSS         |
| Desktop     | Electron + Electron Builder         |
| Backend     | Node.js + Express.js                |
| ORM         | Drizzle ORM                         |
| Database    | PostgreSQL                          |
| Auth        | JWT + bcrypt                        |
| Validation  | Zod                                 |

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Quick Start (Development)

```bash
# 1. Clone / extract the project
cd ritik-chains

# 2. Install dependencies
npm install

# 3. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your PostgreSQL credentials

# 4. Create database
createdb ritik_chains

# 5. Generate migrations & migrate
npm run db:generate
npm run db:migrate

# 6. Seed default admin & master data
npm run db:seed

# 7. Start development servers
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Default Login (after seed)

- Username: `admin`
- Password: `admin123`

**Change the password immediately after first login.**

## Project Structure

```
ritik-chains/
├── backend/                 # Express API + Drizzle
│   ├── src/
│   │   ├── db/              # Schema, migrations, seed
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Auth, validation, error
│   │   ├── services/        # Business logic
│   │   └── utils/
│   └── package.json
├── frontend/                # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/      # Reusable UI
│   │   ├── pages/           # Feature pages
│   │   ├── hooks/
│   │   ├── services/        # API clients
│   │   └── stores/
│   └── package.json
├── electron/                # Desktop wrapper
├── shared/                  # Shared types & utils
├── docs/
└── scripts/
```

## Deployment Modes

### Mode A — Single PC Offline
Run backend + frontend + PostgreSQL locally. Electron packages everything.

### Mode B — LAN Multi-PC
One machine runs the backend + PostgreSQL. Other PCs connect via LAN IP.

### Mode C — Server / Cloud
Deploy backend to any Node host. Point frontend/Electron to the server URL.

## Building Windows Installer

```bash
cd electron
npm run build
```

## License

Proprietary — ToolClub.website for Ritik Chains.
Unauthorized distribution prohibited.
