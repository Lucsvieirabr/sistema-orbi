-- Create bug_reports table (no feature limits, free for all users)
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  imagem_url TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_created_at ON bug_reports(created_at DESC);

-- Enable RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bug reports
CREATE POLICY "Users can view their own bug reports"
  ON bug_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create bug reports
CREATE POLICY "Users can create bug reports"
  ON bug_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bug reports
CREATE POLICY "Users can update their own bug reports"
  ON bug_reports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own bug reports
CREATE POLICY "Users can delete their own bug reports"
  ON bug_reports
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policy: Admins can view all bug reports
CREATE POLICY "Admins can view all bug reports"
  ON bug_reports
  FOR SELECT
  USING (EXISTS(SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));

-- Admin policy: Admins can update all bug reports
CREATE POLICY "Admins can update all bug reports"
  ON bug_reports
  FOR UPDATE
  USING (EXISTS(SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));
