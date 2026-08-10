-- ============================================================
-- SaaS Payment Tracker — Neon Postgres schema
-- Run once against your Neon database (psql, Neon SQL editor,
-- or via `npm run migrate`).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid(), optional

-- ------------------------------------------------------------
-- Admins who can log in to the admin dashboard
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- End customers (FMB ITS Table). its_id is the lookup key
-- on the public portal (e.g. account number, membership ID).
-- Use sabil_no as fallback lookup if needed.
-- its_id MUST be UNIQUE for proper upsert functionality
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fmb_its_tbl (
    id            SERIAL PRIMARY KEY,
    its_id        VARCHAR(50) UNIQUE NOT NULL,
    hof_its       VARCHAR(200),
    sabil_no      VARCHAR(50),
    name          VARCHAR(200) NOT NULL,
    mobile        VARCHAR(30),
    email         VARCHAR(200),
    address       TEXT,
    city          VARCHAR(100),
    pincode       VARCHAR(10),
    sector        VARCHAR(100),
    sub_sector    VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_fmb_its_tbl_its_id ON fmb_its_tbl (its_id);
CREATE INDEX IF NOT EXISTS idx_fmb_its_tbl_sabil_no ON fmb_its_tbl (sabil_no);

-- ------------------------------------------------------------
-- Payment history / billing line items.
-- One row per billing period or per admin upload line.
-- Outstanding for a user = SUM(amount_billed) - SUM(amount_paid)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_records (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES fmb_its_tbl(id) ON DELETE CASCADE,
    period_label   VARCHAR(50),          -- e.g. "Jan 2026" or invoice #
    amount_billed  NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date       DATE,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- paid | partial | pending
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records (user_id);

-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- Payment receipts / transactions received
-- Tracks actual money received per payment transaction
-- One row per payment receipt (append-only history)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fmb_payment_tbl (
    payment_id      SERIAL PRIMARY KEY,
    receipt_no      VARCHAR(50) NOT NULL UNIQUE,
    hof_its         INTEGER NOT NULL REFERENCES fmb_its_tbl(id) ON DELETE CASCADE,
    hof_name        VARCHAR(200) NOT NULL,
    amt_rcv         NUMERIC(12,2) NOT NULL,
    payment_mode    VARCHAR(50) NOT NULL,  -- Cash, Check, Bank Transfer, UPI, NEFT, etc.
    received_date   VARCHAR(10) NOT NULL,  -- YYYY-MM-DD format
    amt_pending     NUMERIC(12,2) NOT NULL,
    payment_refrence VARCHAR(100),
    mobile_no       VARCHAR(30),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fmb_payment_tbl_hof_its ON fmb_payment_tbl (hof_its);
CREATE INDEX IF NOT EXISTS idx_fmb_payment_tbl_receipt_no ON fmb_payment_tbl (receipt_no);
CREATE INDEX IF NOT EXISTS idx_fmb_payment_tbl_received_date ON fmb_payment_tbl (received_date);

-- Seed a default admin: username "admin", password "admin123"
-- CHANGE THIS PASSWORD IMMEDIATELY after first login / before
-- going live. Hash below is bcrypt of "admin123".
-- Generate a new one with: node -e "console.log(require('bcryptjs').hashSync('yourpassword',10))"
-- ------------------------------------------------------------
INSERT INTO admins (username, password_hash)
VALUES ('admin', '$2a$10$KTL3c7VIdUgznUzf2YmD1uFQ/r.AUj4Zc9YecLxX.oU7m59HHXiXq')
ON CONFLICT (username) DO NOTHING;
