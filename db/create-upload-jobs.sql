-- Create upload_jobs table for async file processing
CREATE TABLE IF NOT EXISTS upload_jobs (
    id SERIAL PRIMARY KEY,
    file_data BYTEA NOT NULL,
    admin_username VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0, -- 0-100 percentage
    summary JSONB,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Add progress column if it doesn't exist (for existing databases)
ALTER TABLE IF EXISTS upload_jobs
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON upload_jobs(status);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_at ON upload_jobs(created_at DESC);
