# Hama Construction Platform

Full-stack construction platform: asset reservations, tool hire, worker hire, installments, and project management.

**Stack:** Next.js 15 · Prisma · PostgreSQL (Neon) · Tailwind CSS · JWT auth

## Production setup

### 1. Environment variables (Vercel / `.env`)

```env
construction_storage_PRISMA_DATABASE_URL="postgresql://..."
JWT_SECRET="long-random-secret-at-least-32-characters"
SETUP_SECRET="another-long-secret-for-one-time-admin-setup"
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"

# Optional: create admin during `npm run db:seed`
ADMIN_EMAIL="you@yourcompany.com"
ADMIN_PASSWORD="strong-password-min-8-chars"
ADMIN_NAME="Your Name"
```

### 2. Database

```bash
npx prisma generate
npx prisma db push
npm run db:seed   # category rules only (+ admin if ADMIN_* set)
```

### 3. Create the first admin (if not seeded)

```bash
curl -X POST https://YOUR_DOMAIN/api/setup/admin \
  -H "Content-Type: application/json" \
  -H "x-setup-secret: YOUR_SETUP_SECRET" \
  -d '{"email":"you@yourcompany.com","password":"YourStrongPassword","name":"Admin"}'
```

Then sign in at `/login`. **Do not commit passwords.**

### 4. Remove old demo data (if the database was seeded earlier)

```bash
curl -X POST https://YOUR_DOMAIN/api/setup/purge-demo \
  -H "Content-Type: application/json" \
  -H "x-setup-secret: YOUR_SETUP_SECRET" \
  -d '{"purgeCatalog":true}'
```

This deletes demo users (`admin@buildforge.com`, `client@example.com`) and, with `purgeCatalog: true`, all listings so you start clean.

### 5. Add real content

In **Admin Control** (`/admin` after login):

- Customers, reservations, payments  
- Assets / land, tools, workers (with image URLs)  
- Finished projects  

Clients register at `/register` (terms + approval flow).

## Local development

```bash
npm install
# set .env with Postgres URL + JWT_SECRET + SETUP_SECRET
npx prisma db push
npm run db:seed
npm run dev
```

## Security notes

- Demo seed API is **disabled** (`/api/seed` returns 410).
- Passwords are bcrypt-hashed (cost 12).
- Set `SETUP_ALLOW_RESET=true` only temporarily if you must recreate an admin when one already exists.
- Configure Stripe keys when you enable live payments.

## License

Private — Hama Construction.
