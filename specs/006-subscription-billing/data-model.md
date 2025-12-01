# Data Model: Subscription Billing and Payment Management

**Feature**: `006-subscription-billing`
**Date**: 2025-11-05
**Database**: Supabase PostgreSQL

## Overview

This data model supports a comprehensive subscription billing system with three plan tiers (Free, Pro, Team), usage-based quotas, team management, and full subscription lifecycle tracking. All tables use Row-Level Security (RLS) policies to enforce access control.

## Entity Relationship Diagram

```
profiles (existing)
    ↓ 1:1
subscriptions ←──────── stripe_customers
    ↓ 1:many              ↓ 1:many
subscription_events   payment_methods

subscriptions (team type)
    ↓ 1:many
teams
    ↓ 1:many
team_members → profiles

profiles
    ↓ 1:many
usage_records

subscriptions
    ↓ 1:many
invoices
    ↓ 1:1
credit_balances

subscriptions (past_due)
    ↓ 1:many
dunning_attempts

stripe_events (webhook processing)
```

## Core Entities

### 1. subscriptions

Represents active, canceled, or suspended subscriptions linked to user profiles.

```sql
CREATE TABLE subscriptions (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Stripe Integration
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,

  -- Plan Details
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'pro', 'team')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'suspended')),

  -- Billing Periods
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_end TIMESTAMPTZ, -- NULL if no trial or trial already ended
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,

  -- Team-Specific (NULL for individual plans)
  seat_count INTEGER CHECK (seat_count IS NULL OR seat_count >= 3),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_team_subscription CHECK (
    (plan_type = 'team' AND seat_count IS NOT NULL AND team_id IS NOT NULL) OR
    (plan_type != 'team' AND seat_count IS NULL AND team_id IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status IN ('active', 'trialing', 'past_due');
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end) WHERE trial_end IS NOT NULL;

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

**State Transitions**:
- `trialing` → `active` (trial ends with successful payment)
- `trialing` → `canceled` (trial canceled before conversion)
- `active` → `past_due` (payment failure)
- `past_due` → `active` (payment recovered)
- `past_due` → `suspended` (grace period expired, 14 days)
- `active` → `canceled` (user cancellation or payment failure after retries)
- `suspended` → `active` (payment method updated and payment succeeds)

### 2. stripe_customers

Maps Supabase users to Stripe Customer objects.

```sql
CREATE TABLE stripe_customers (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,

  -- Customer Details
  email TEXT NOT NULL,
  name TEXT,

  -- Default Payment Method
  default_payment_method_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stripe_customers_user ON stripe_customers(user_id);
CREATE UNIQUE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

-- RLS Policies
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Stripe customer"
  ON stripe_customers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all Stripe customers"
  ON stripe_customers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 3. payment_methods

Stores tokenized payment method references (no raw card data).

```sql
CREATE TABLE payment_methods (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,

  -- Card Details (from Stripe, for display only)
  card_brand TEXT, -- visa, mastercard, amex, etc.
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,

  -- Billing Address
  billing_address JSONB, -- {line1, line2, city, state, postal_code, country}

  -- Flags
  is_default BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = TRUE;

-- RLS Policies
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods"
  ON payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment methods"
  ON payment_methods FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 4. teams

Represents team subscriptions with multi-user management.

```sql
CREATE TABLE teams (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,

  -- Team Admin
  admin_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- Subscription Link
  subscription_id UUID UNIQUE REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Capacity
  seat_count INTEGER NOT NULL CHECK (seat_count >= 3),
  filled_seats INTEGER DEFAULT 1 CHECK (filled_seats >= 1 AND filled_seats <= seat_count),

  -- Billing Contact (optional)
  billing_email TEXT,
  company_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_teams_admin ON teams(admin_user_id);
CREATE INDEX idx_teams_subscription ON teams(subscription_id);

-- RLS Policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their team"
  ON teams FOR SELECT
  USING (
    auth.uid() = admin_user_id OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

CREATE POLICY "Team admin can manage team"
  ON teams FOR UPDATE
  USING (auth.uid() = admin_user_id);

CREATE POLICY "Service role can manage all teams"
  ON teams FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 5. team_members

Tracks team membership and invitation status.

```sql
CREATE TABLE team_members (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Role
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',

  -- Invitation
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'removed')) DEFAULT 'pending',
  invitation_token TEXT UNIQUE,
  invitation_expires_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(team_id, user_id)
);

-- Indexes
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_status ON team_members(team_id, status) WHERE status = 'active';
CREATE INDEX idx_team_members_invitation ON team_members(invitation_token) WHERE status = 'pending';

-- RLS Policies
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view team membership"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND (teams.admin_user_id = auth.uid() OR team_members.user_id = auth.uid())
    )
  );

CREATE POLICY "Service role can manage all team members"
  ON team_members FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 6. usage_records

Tracks resource consumption against plan quotas.

```sql
CREATE TABLE usage_records (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Billing Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Usage Metrics
  screenshot_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, period_start)
);

-- Indexes
CREATE INDEX idx_usage_records_user ON usage_records(user_id);
CREATE INDEX idx_usage_records_period ON usage_records(user_id, period_start, period_end);

-- RLS Policies
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage records"
  ON usage_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all usage records"
  ON usage_records FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 7. invoices

Records all financial transactions and invoice history.

```sql
CREATE TABLE invoices (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Stripe Integration
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_hosted_invoice_url TEXT,
  stripe_invoice_pdf TEXT,

  -- Invoice Details
  invoice_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),

  -- Amounts (in cents)
  subtotal INTEGER NOT NULL,
  tax INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  amount_paid INTEGER DEFAULT 0,
  amount_due INTEGER NOT NULL,

  -- Line Items
  line_items JSONB NOT NULL, -- Array of {description, quantity, unit_amount, amount}

  -- Dates
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);

-- RLS Policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all invoices"
  ON invoices FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 8. credit_balances

Tracks account credits from downgrades and refunds.

```sql
CREATE TABLE credit_balances (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Balance (in cents)
  current_balance INTEGER DEFAULT 0 CHECK (current_balance >= 0),

  -- Transaction History
  transactions JSONB DEFAULT '[]'::jsonb, -- Array of {type, amount, description, timestamp}

  -- Expiration
  expires_at TIMESTAMPTZ, -- NULL for no expiration

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_balances_user ON credit_balances(user_id);
CREATE INDEX idx_credit_balances_expiring ON credit_balances(expires_at) WHERE expires_at IS NOT NULL;

-- RLS Policies
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit balance"
  ON credit_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all credit balances"
  ON credit_balances FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 9. subscription_events

Audit log of all subscription lifecycle changes.

```sql
CREATE TABLE subscription_events (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'trial_started',
    'trial_converted',
    'trial_canceled',
    'upgraded',
    'downgraded',
    'canceled',
    'reactivated',
    'payment_succeeded',
    'payment_failed',
    'suspended',
    'resumed'
  )),

  -- State Transition
  previous_plan TEXT,
  new_plan TEXT,
  previous_status TEXT,
  new_status TEXT,

  -- Metadata
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscription_events_subscription ON subscription_events(subscription_id, created_at DESC);
CREATE INDEX idx_subscription_events_user ON subscription_events(user_id, created_at DESC);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type, created_at DESC);

-- RLS Policies
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription events"
  ON subscription_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscription events"
  ON subscription_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 10. dunning_attempts

Tracks payment recovery attempts during the grace period.

```sql
CREATE TABLE dunning_attempts (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

  -- Attempt Details
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  attempt_date TIMESTAMPTZ NOT NULL,

  -- Payment Result
  payment_result TEXT NOT NULL CHECK (payment_result IN ('pending', 'success', 'failed')),
  failure_reason TEXT,

  -- Next Retry
  next_retry_date TIMESTAMPTZ,

  -- Notification
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(subscription_id, attempt_number)
);

-- Indexes
CREATE INDEX idx_dunning_attempts_subscription ON dunning_attempts(subscription_id);
CREATE INDEX idx_dunning_attempts_next_retry ON dunning_attempts(next_retry_date) WHERE payment_result = 'failed';

-- RLS Policies
ALTER TABLE dunning_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dunning attempts"
  ON dunning_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = dunning_attempts.subscription_id
      AND subscriptions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all dunning attempts"
  ON dunning_attempts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 11. stripe_events

Webhook event log for idempotency and debugging.

```sql
CREATE TABLE stripe_events (
  -- Identity (Stripe event ID for idempotency)
  id TEXT PRIMARY KEY, -- Stripe event ID

  -- Event Details
  type TEXT NOT NULL,
  api_version TEXT,

  -- Payload
  data JSONB NOT NULL,

  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stripe_events_type ON stripe_events(type, created_at DESC);
CREATE INDEX idx_stripe_events_processed ON stripe_events(processed, created_at) WHERE processed = FALSE;

-- RLS Policies (disabled - service-only table)
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON stripe_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

## Database Triggers

### Auto-update timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_usage_records_updated_at
  BEFORE UPDATE ON usage_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_credit_balances_updated_at
  BEFORE UPDATE ON credit_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_dunning_attempts_updated_at
  BEFORE UPDATE ON dunning_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Sync team filled_seats count

```sql
CREATE OR REPLACE FUNCTION sync_team_filled_seats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE teams
  SET filled_seats = (
    SELECT COUNT(*)
    FROM team_members
    WHERE team_members.team_id = COALESCE(NEW.team_id, OLD.team_id)
    AND team_members.status = 'active'
  )
  WHERE id = COALESCE(NEW.team_id, OLD.team_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_team_filled_seats_insert
  AFTER INSERT ON team_members
  FOR EACH ROW EXECUTE FUNCTION sync_team_filled_seats();

CREATE TRIGGER sync_team_filled_seats_update
  AFTER UPDATE OF status ON team_members
  FOR EACH ROW EXECUTE FUNCTION sync_team_filled_seats();

CREATE TRIGGER sync_team_filled_seats_delete
  AFTER DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION sync_team_filled_seats();
```

### Update profile plan on subscription change

```sql
CREATE OR REPLACE FUNCTION sync_profile_plan()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if status is active or trialing
  IF NEW.status IN ('active', 'trialing') THEN
    UPDATE profiles
    SET plan = NEW.plan_type
    WHERE id = NEW.user_id;
  -- If canceled or suspended, revert to free
  ELSIF NEW.status IN ('canceled', 'suspended') THEN
    UPDATE profiles
    SET plan = 'free'
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_profile_plan_insert
  AFTER INSERT ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_profile_plan();

CREATE TRIGGER sync_profile_plan_update
  AFTER UPDATE OF status, plan_type ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_profile_plan();
```

## Validation Rules

### Quota Limits

```sql
CREATE OR REPLACE FUNCTION check_upload_quota(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  quota_limit INTEGER,
  plan_type TEXT
) AS $$
DECLARE
  v_plan TEXT;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_current_count INTEGER;
  v_quota_limit INTEGER;
BEGIN
  -- Get user's current plan
  SELECT plan INTO v_plan FROM profiles WHERE id = p_user_id;

  -- Set quota based on plan
  CASE v_plan
    WHEN 'free' THEN v_quota_limit := 10;
    WHEN 'pro' THEN v_quota_limit := NULL; -- unlimited
    WHEN 'team' THEN v_quota_limit := NULL; -- unlimited
  END CASE;

  -- Get current billing period
  SELECT
    current_period_start,
    current_period_end
  INTO v_period_start, v_period_end
  FROM subscriptions
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no subscription found, use calendar month for free users
  IF v_period_start IS NULL THEN
    v_period_start := DATE_TRUNC('month', NOW());
    v_period_end := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month');
  END IF;

  -- Get current usage count
  SELECT COALESCE(screenshot_count, 0)
  INTO v_current_count
  FROM usage_records
  WHERE user_id = p_user_id
  AND period_start = v_period_start;

  -- Return result
  RETURN QUERY SELECT
    (v_quota_limit IS NULL OR v_current_count < v_quota_limit) AS allowed,
    v_current_count AS current_count,
    v_quota_limit AS quota_limit,
    v_plan AS plan_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Migration Strategy

### Phase 1: Core Tables (Week 1)
1. `stripe_customers`
2. `payment_methods`
3. `subscriptions`
4. `stripe_events`

### Phase 2: Usage & Tracking (Week 2)
1. `usage_records`
2. `subscription_events`
3. `dunning_attempts`

### Phase 3: Team Billing (Week 3)
1. `teams`
2. `team_members`

### Phase 4: Financial (Week 4)
1. `invoices`
2. `credit_balances`

### Phase 5: Triggers & Functions (Week 5)
1. Timestamp triggers
2. Team seat sync
3. Profile plan sync
4. Quota check function

## Data Retention Policies

| Table | Retention | Archive Strategy |
|-------|-----------|------------------|
| `subscriptions` | Indefinite | Soft delete (canceled_at) |
| `subscription_events` | 2 years | Move to cold storage |
| `invoices` | 7 years | Required for tax/legal compliance |
| `stripe_events` | 90 days | Delete after processing |
| `usage_records` | 1 year | Aggregate then delete |
| `dunning_attempts` | 1 year | Delete after resolution |
| `credit_balances` | Until used | Expire unused credits after 1 year |
| `payment_methods` | Until removed | Delete when customer is deleted |

## Performance Considerations

### Expected Load
- **Subscriptions**: 10K active, 1K new per month
- **Invoices**: 10K per month
- **Webhook Events**: 50K per month
- **Usage Records**: 10K updated per day

### Optimization Strategies
1. **Partitioning**: Consider partitioning `stripe_events` and `subscription_events` by month if volume exceeds 1M rows
2. **Materialized Views**: Create aggregated views for analytics (MRR, churn rate)
3. **Caching**: Cache active subscription status in Redis for quota checks
4. **Archival**: Move old `stripe_events` to cold storage after 90 days
