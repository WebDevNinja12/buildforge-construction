# Hama Construction — Production checklist

## Environment variables (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` / Neon pooler URL | Yes | Prefer **pooled** connection string |
| `JWT_SECRET` | Yes | **Min 32 random chars.** `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | Yes | Live domain |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Yes | Bootstrap admin |
| `SUPER_ADMIN_EMAILS` | Recommended | Gates contract terminate + asset reopen |
| `BLOB_READ_WRITE_TOKEN` | Yes for uploads | Vercel Blob connected to project |
| `RESEND_API_KEY` / `EMAIL_FROM` | Recommended | Email |
| `CRON_SECRET` | Recommended | Protect maintenance cron |
| `SENTRY_DSN` | Optional | Error webhook |

Never leave the default JWT secret in production.

## Vercel Blob

1. Vercel → Storage → Create Blob store  
2. Connect to this project  
3. Token injects as `BLOB_READ_WRITE_TOKEN`  
4. Test image upload in Admin → Services  

## Neon backups

- Enable PITR / scheduled backups in Neon console.  
- Keep a restore contact and target RPO/RTO.  
- Optional weekly `prisma db pull` + SQL dump for compliance.  

## Cron

`vercel.json` runs `/api/cron/maintenance` daily. Flags overdue tool hires, expires unpaid holds, restocks cancelled/expired tools.

## Ops features

- Admin → Tool returns — checklist, deposit, restock  
- Admin → Sold / Archive — archive sold or reopen for sale  
- Contract terminate API with reason (Super-Admin gated)  
- Refund mark processed → activity log  

## Smoke test

```bash
node scripts/load-smoke.mjs https://your-domain.com
```

## Legal pages

- `/privacy`  
- `/terms`  
