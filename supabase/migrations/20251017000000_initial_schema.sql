-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  downgraded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Screenshots table
CREATE TABLE screenshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  short_id TEXT UNIQUE NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  mime_type TEXT DEFAULT 'image/png',
  expires_at TIMESTAMP WITH TIME ZONE,
  views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly usage table
CREATE TABLE monthly_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  screenshot_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Stripe events table
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_screenshots_user_created ON screenshots(user_id, created_at DESC);
CREATE INDEX idx_screenshots_short_id ON screenshots(short_id);
CREATE INDEX idx_screenshots_expires ON screenshots(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_monthly_usage_user_month ON monthly_usage(user_id, month);
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (optimized with SELECT wrapper for better performance)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING ((select auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING ((select auth.uid()) = id);
CREATE POLICY "Service can insert profiles" ON profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own screenshots" ON screenshots FOR SELECT USING ((select auth.uid()) = user_id OR is_public = true);
CREATE POLICY "Users can insert own screenshots" ON screenshots FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own screenshots" ON screenshots FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own screenshots" ON screenshots FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own usage" ON monthly_usage FOR SELECT USING ((select auth.uid()) = user_id);

-- Note: stripe_events has RLS enabled but no policies (blocks PostgREST access, service role still works)

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_screenshots_updated_at BEFORE UPDATE ON screenshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

