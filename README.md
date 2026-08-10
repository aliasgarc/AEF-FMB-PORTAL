# SaaS Payment Tracker

Admin dashboard + public user portal for tracking per-user payments and
outstanding dues. Plain HTML/CSS/JS front-ends, Express backend, Neon
Postgres, deployable on Vercel.

## Structure

```
├── api/index.js          # Vercel serverless entry (wraps src/app.js)
├── server.js             # Local dev entry (node server.js)
├── src/
│   ├── app.js             # Express app (shared by both entry points)
│   ├── db.js               # Postgres pool (Neon, SSL)
│   ├── auth.js              # Admin login / JWT cookie auth
│   ├── routes/admin.js       # Admin API (protected)
│   ├── routes/user.js         # Public user lookup API
│   └── utils/excelParser.js    # Parses uploaded Excel into rows
├── public/
│   ├── shared.css
│   ├── admin/ (login.html, dashboard.html, admin.js)
│   └── user/  (index.html, user.js)
├── db/
│   ├── schema.sql          # Tables + seed admin
│   └── migrate.js           # Applies schema.sql to DATABASE_URL
└── vercel.json
```

## 1. Set up Neon

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string (Dashboard → Connection Details →
   toggle "Pooled connection").
3. Put it in `.env` as `DATABASE_URL` (copy `.env.example` → `.env` first).

## 2. Apply the schema

```bash
npm install
npm run migrate
```

This creates `admins`, `users`, `payment_records`, and seeds one admin:

```
username: admin
password: admin123
```

**Change this password before going live** — either update the hash directly
in the `admins` table, or add a simple "change password" admin endpoint later.
To generate a new hash:
```bash
node -e "console.log(require('bcryptjs').hashSync('yourNewPassword', 10))"
```

## 3. Run locally

```bash
npm run dev
```

- Admin: http://localhost:3000/admin
- User portal: http://localhost:3000/user

## 4. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, "Import Project" from the repo.
3. Add environment variables in Vercel project settings:
   - `DATABASE_URL` — your Neon pooled connection string
   - `JWT_SECRET` — a long random string
4. Deploy. Vercel picks up `vercel.json`, which routes all requests through
   `api/index.js` (the same Express app used locally).
5. Run the migration once against your Neon DB (from your machine, with
   `.env` pointed at the same `DATABASE_URL`): `npm run migrate`.

Your two shareable URLs:
- **Admin**: `https://your-app.vercel.app/admin`
- **User portal**: `https://your-app.vercel.app/user`

## 5. Excel upload format

The admin dashboard's upload accepts `.xlsx` / `.xls` with a header row
containing (case-insensitive, order doesn't matter):

| Column | Required | Notes |
|---|---|---|
| its_id | recommended | matches/creates the user (primary lookup key) |
| sabil_no | optional | alternative identifier |
| hof_its | optional | |
| name | yes | user's full name |
| address | no | |
| mobile | no | phone number |
| email | no | |
| city | no | |
| pincode | no | postal/zip code |
| sector | no | |
| sub_sector | no | |
| period_label | no | e.g. "Jan 2026" or invoice # |
| amount_billed | no | numeric |
| amount_paid | no | numeric |
| due_date | no | date |
| status | no | paid / partial / pending (auto-computed if omitted) |
| notes | no | |

Each row upserts the user by `its_id` and, if it carries any billing
info, appends a new payment record (so history accumulates rather than
being overwritten). A sample file is at `sample-upload.xlsx` (create your
own from `sample-upload-template.csv`).

## 6. Payment Receipt Uploads

The system supports uploading payment receipts via Excel/CSV to track actual
payments received:

**Endpoint**: `/api/admin/upload-payments` (POST)

**Required Columns**:
- `receipt_no` — unique receipt identifier
- `hof_its` — HOF ITS ID (numeric)
- `hof_name` — HOF/Payer name
- `amt_rcv` — amount received (numeric)
- `payment_mode` — payment method (Cash, Check, Bank Transfer, UPI, NEFT, etc.)
- `received_date` — payment date (YYYY-MM-DD)
- `amt_pending` — amount still pending

**Optional Columns**:
- `payment_refrence` — bank/check reference
- `mobile_no` — contact number

See `PAYMENT_SCHEMA.md` for complete documentation and `sample-upload-template.csv`
for an example.

**Key Points**:
- One row per payment receipt (append-only)
- Receipt numbers must be unique
- HOF ITS ID must exist in the system
- System validates all required fields

---

## Notes / next steps

- Theme is intentionally plain (see `public/shared.css`) — swap colors/fonts
  there once you're ready to restyle.
- User "login" is just their ITS ID (no password), matching the
  original spec. Add a second factor (e.g. phone/email confirmation) later
  if needed.
- Both `payment_records` (billing) and `fmb_payment_tbl` (receipts) are append-only
  histories; data integrity maintained through database constraints.
