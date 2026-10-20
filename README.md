# BuildForge – Construction Platform

Full-stack construction website built with **Next.js 15**, **Prisma**, **SQLite**, and **Tailwind CSS**.

## Features

- **Static pages**: Home, About Us, Contact
- **Services page** (interactive):
  - Buy & reserve houses, hotels, apartments, commercial properties
  - Land listing and payment-plan info
  - Tool & equipment hiring (daily/weekly rates)
  - Construction worker hiring (specialists & crews)
  - Project management (create & track projects)
- **Auth**: Register / Login with JWT cookies
- **Dashboard**: Reservations, rentals, hire requests, projects, payments
- **Modern construction theme**: Blues, grays, orange accents

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Prisma + SQLite (easy to switch to PostgreSQL)
- Tailwind CSS
- jose (JWT) + bcryptjs
- Lucide icons

## Quick Start

### 1. Install dependencies

```bash
cd construction-site
npm install
```

### 2. Environment

Copy `.env` and set values (already has defaults for local SQLite):

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-long-random-secret-at-least-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional – Stripe (replace with your keys)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 3. Database

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Accounts (after seed)

| Role   | Email                  | Password   |
|--------|------------------------|------------|
| Admin  | admin@buildforge.com   | admin123   |
| Client | client@example.com     | client123  |

## Project Structure

```
src/
  app/
    page.tsx              # Home
    about/                # About Us
    contact/              # Contact form
    services/             # Main interactive services
    login/ register/      # Auth
    dashboard/            # User dashboard
    api/                  # API routes
  components/             # Navbar, Footer, etc.
  lib/                    # prisma, auth, utils
prisma/
  schema.prisma
  seed.ts
```

## Switching to PostgreSQL

1. Change `provider` in `prisma/schema.prisma` to `"postgresql"`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. Run `npx prisma db push` and seed again.

## Payments (Stripe)

Payment records are created with status `PENDING`. To integrate Stripe:

1. Add your keys to `.env`.
2. Create checkout sessions in the reservation / rental / hire API routes.
3. Use webhooks to mark payments `COMPLETED` and update related entities.

## License

MIT – use and adapt for your construction business.
