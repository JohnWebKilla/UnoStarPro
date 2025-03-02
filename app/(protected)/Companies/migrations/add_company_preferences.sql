-- Add new columns for company preferences
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_invoice BOOLEAN DEFAULT false;

-- Set NOT NULL constraints
ALTER TABLE companies 
  ALTER COLUMN timezone SET NOT NULL,
  ALTER COLUMN notifications_enabled SET NOT NULL,
  ALTER COLUMN auto_invoice SET NOT NULL; 