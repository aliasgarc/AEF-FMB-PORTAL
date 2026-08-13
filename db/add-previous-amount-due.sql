-- Add previous_amount_due column to payment_records table
ALTER TABLE IF EXISTS payment_records
ADD COLUMN IF NOT EXISTS previous_amount_due NUMERIC(12,2) DEFAULT 0;

-- Add previous_amount_due column to fmb_takhmeen table if it exists
ALTER TABLE IF EXISTS fmb_takhmeen
ADD COLUMN IF NOT EXISTS previous_amount_due NUMERIC(12,2) DEFAULT 0;

-- Also add updated_at column to payment_records if it doesn't exist
ALTER TABLE IF EXISTS payment_records
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Also add updated_at column to fmb_takhmeen if it doesn't exist
ALTER TABLE IF EXISTS fmb_takhmeen
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
