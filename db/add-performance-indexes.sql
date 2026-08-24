-- ============================================================
-- Performance Optimization: Add missing indexes
-- Improves query speed for dashboard and analytics
-- ============================================================

-- Index on fmb_takhmeen.hof_its for frequent lookups in admin dashboard
CREATE INDEX IF NOT EXISTS idx_fmb_takhmeen_hof_its ON fmb_takhmeen (hof_its);

-- Index on fmb_takhmeen.takhmeen_yr for year-based filtering
CREATE INDEX IF NOT EXISTS idx_fmb_takhmeen_year ON fmb_takhmeen (takhmeen_yr);

-- Index on app_installations for analytics queries
CREATE INDEX IF NOT EXISTS idx_app_installations_installed_at ON app_installations (installed_at);
CREATE INDEX IF NOT EXISTS idx_app_installations_its_id ON app_installations (its_id);
CREATE INDEX IF NOT EXISTS idx_app_installations_app_version ON app_installations (app_version);
CREATE INDEX IF NOT EXISTS idx_app_installations_last_active ON app_installations (last_active);

-- Composite index for common analytics queries (date range + detection method)
CREATE INDEX IF NOT EXISTS idx_app_installations_date_method ON app_installations (installed_at, detection_method);

-- Update fmb_payment_tbl.updated_at trigger if needed
ALTER TABLE IF EXISTS fmb_payment_tbl
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
