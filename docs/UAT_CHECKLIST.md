# Hama Construction — UAT & production checklists

## A. Tools route (admin)

1. Log in as **admin**.
2. Open **https://buildforge-construction.vercel.app/admin/tools**  
   - Expect: Tools inventory (Add tool form / empty state), **not** black 404.
3. Fallback: **Services → Tools hire** or  
   `/admin/services?section=tools`
4. **Tool returns:** `/admin/tool-returns` — list active hires, complete return (condition + deposit + restock).

If `/admin/tools` still 404 after a **new** Production deploy of `main`, force redeploy in Vercel (Promote latest commit).

---

## B. Payment + installment end-to-end

### Bank transfer details (expected on pay screens)

| Field | Value |
|-------|--------|
| Bank | Opay |
| Account | 6141488817 |
| Name | HAMA ENTERPRISE NG |

### Client flow — sale asset (house / land)

1. Browse **Services** → open a HOUSE or LAND listing.
2. Reserve → pay **reservation fee** (house/land: ₦50,000 style rule if configured).
3. Choose **Full** or **Installment**.
4. **Installment:** first payment ~40% of plan total; later ~20% steps.  
   House/land plan may show **5% admin increment (not interest)** disclosure.
5. **First installment only:** upload documents (NIN if not already on profile, etc.) → wait admin approval before next steps.
6. Submit bank transfer → appears **PENDING** for admin (first installment).
7. Admin **Approves** → balance updates; further installments may auto-apply + notify admin.
8. When balance = 0 → service completes / marked sold path for sale assets.

### Client flow — tool hire

1. Public tools / hire → create rental.
2. Set payment **FULL** or **INSTALLMENT**.
3. Pay via bank transfer panel (Opay details visible).
4. Admin approves first payment if needed.
5. At hire end: admin **Tool returns** → condition + deposit → restock quantity.

### Client flow — workers / other

1. Workers: typically **no installment** (confirm UI).
2. Hotel / short holds: reservation window rules + extension if implemented.

### Admin payment checks

1. **Payments** — filter PENDING → Approve / Reject (bulk if available).
2. **Installment Plans** — see schedule and balances.
3. **Documents** — approve first-installment docs.
4. **Cancellations** — full refund vs 10% deduction options.

### Negative tests

- Fully paid service: client **cannot** cancel.
- Cancel unpaid/partial: 10% deduction messaging + 7-day refund period.
- Wrong role: client cannot hit admin APIs (403).

---

## C. Production checklist (ops)

| Item | Status / action |
|------|------------------|
| `JWT_SECRET` ≥ 32 random chars on Vercel | Set in Production env |
| Neon pooled `DATABASE_URL` | Set |
| Vercel Blob `BLOB_READ_WRITE_TOKEN` | Connect Blob store |
| `NEXT_PUBLIC_APP_URL` = live URL | Set |
| `SUPER_ADMIN_EMAILS` for terminate/reopen | Recommended |
| Cron `/api/cron/maintenance` + `CRON_SECRET` | vercel.json daily |
| Neon backups / PITR | Enable in Neon |
| `/privacy` + `/terms` | Present |
| Email (Resend) | Optional but needed for real notifications |
| Sentry | Optional |
| Admin **Deals** `/admin/deals` | Accept/reject pipeline |
| Admin **Sold** `/admin/sold` | Archive / reopen |
| Admin **Tool returns** `/admin/tool-returns` | Condition + restock |
| Purge demo via setup/purge if still seeded | One-time |

### Smoke commands

```bash
curl -s https://buildforge-construction.vercel.app/api/health
node scripts/load-smoke.mjs https://buildforge-construction.vercel.app
```
