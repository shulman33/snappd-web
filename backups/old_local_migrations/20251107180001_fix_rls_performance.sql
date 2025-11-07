-- Migration: Fix RLS Performance Issues
-- Drop ALL old policies and create optimized replacements
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ===========================================================================
-- Step 1: Drop ALL existing policies (both old naming and new naming)
-- ===========================================================================

-- Credit Balances
DROP POLICY IF EXISTS "credit_balances_all" ON public.credit_balances;
DROP POLICY IF EXISTS "credit_balances_select" ON public.credit_balances;
DROP POLICY IF EXISTS "Service role can manage all credit balances" ON public.credit_balances;
DROP POLICY IF EXISTS "Users can view own credit balance" ON public.credit_balances;

-- Dunning Attempts
DROP POLICY IF EXISTS "dunning_attempts_all" ON public.dunning_attempts;
DROP POLICY IF EXISTS "dunning_attempts_select" ON public.dunning_attempts;
DROP POLICY IF EXISTS "Service role can manage all dunning attempts" ON public.dunning_attempts;
DROP POLICY IF EXISTS "Users can view own dunning attempts" ON public.dunning_attempts;

-- Invoices
DROP POLICY IF EXISTS "invoices_all" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
DROP POLICY IF EXISTS "Service role can manage all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;

-- Payment Methods
DROP POLICY IF EXISTS "payment_methods_all" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_select" ON public.payment_methods;
DROP POLICY IF EXISTS "Service role can manage all payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Users can view own payment methods" ON public.payment_methods;

-- Stripe Customers
DROP POLICY IF EXISTS "stripe_customers_all" ON public.stripe_customers;
DROP POLICY IF EXISTS "stripe_customers_select" ON public.stripe_customers;
DROP POLICY IF EXISTS "Service role can manage all Stripe customers" ON public.stripe_customers;
DROP POLICY IF EXISTS "Users can view own Stripe customer" ON public.stripe_customers;

-- Subscription Events
DROP POLICY IF EXISTS "subscription_events_all" ON public.subscription_events;
DROP POLICY IF EXISTS "subscription_events_select" ON public.subscription_events;
DROP POLICY IF EXISTS "Service role can manage all subscription events" ON public.subscription_events;
DROP POLICY IF EXISTS "Users can view own subscription events" ON public.subscription_events;

-- Subscriptions
DROP POLICY IF EXISTS "subscriptions_all" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;

-- Team Members
DROP POLICY IF EXISTS "team_members_all" ON public.team_members;
DROP POLICY IF EXISTS "team_members_select" ON public.team_members;
DROP POLICY IF EXISTS "Service role can manage all team members" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view team membership" ON public.team_members;

-- Teams (has multiple actions)
DROP POLICY IF EXISTS "teams_all" ON public.teams;
DROP POLICY IF EXISTS "teams_select" ON public.teams;
DROP POLICY IF EXISTS "teams_insert" ON public.teams;
DROP POLICY IF EXISTS "teams_update" ON public.teams;
DROP POLICY IF EXISTS "teams_delete" ON public.teams;
DROP POLICY IF EXISTS "Service role can manage all teams" ON public.teams;
DROP POLICY IF EXISTS "Service role for teams insert" ON public.teams;
DROP POLICY IF EXISTS "Team admin can manage team" ON public.teams;
DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;

-- Usage Records
DROP POLICY IF EXISTS "usage_records_all" ON public.usage_records;
DROP POLICY IF EXISTS "usage_records_select" ON public.usage_records;
DROP POLICY IF EXISTS "Service role can manage all usage records" ON public.usage_records;
DROP POLICY IF EXISTS "Users can view own usage records" ON public.usage_records;

-- ===========================================================================
-- Step 2: Create NEW optimized policies (one per action, optimized auth.uid())
-- ===========================================================================

-- CREDIT BALANCES
CREATE POLICY "Users can view own credit balance"
  ON public.credit_balances
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = user_id);

-- DUNNING ATTEMPTS
CREATE POLICY "Users can view own dunning attempts"
  ON public.dunning_attempts
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM subscriptions
      WHERE subscriptions.id = dunning_attempts.subscription_id
        AND subscriptions.user_id = (SELECT auth.uid())
    )
  );

-- INVOICES
CREATE POLICY "Users can view own invoices"
  ON public.invoices
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = user_id);

-- PAYMENT METHODS
CREATE POLICY "Users can view own payment methods"
  ON public.payment_methods
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = user_id);

-- STRIPE CUSTOMERS
CREATE POLICY "Users can view own Stripe customer"
  ON public.stripe_customers
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = user_id);

-- SUBSCRIPTION EVENTS
CREATE POLICY "Users can view own subscription events"
  ON public.subscription_events
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = user_id);

-- SUBSCRIPTIONS
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = user_id);

-- TEAM MEMBERS
CREATE POLICY "Team members can view team membership"
  ON public.team_members
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM teams
      WHERE teams.id = team_members.team_id
        AND (teams.admin_user_id = (SELECT auth.uid()) OR team_members.user_id = (SELECT auth.uid()))
    )
  );

-- TEAMS (has multiple policies for different actions)
CREATE POLICY "Team members can view their team"
  ON public.teams
  FOR SELECT
  TO public
  USING (
    (SELECT auth.uid()) = admin_user_id
    OR EXISTS (
      SELECT 1
      FROM team_members
      WHERE team_members.team_id = teams.id
        AND team_members.user_id = (SELECT auth.uid())
        AND team_members.status = 'active'
    )
  );

CREATE POLICY "Team admin can manage team"
  ON public.teams
  FOR UPDATE
  TO public
  USING ((SELECT auth.uid()) = admin_user_id);

CREATE POLICY "Service role for teams insert"
  ON public.teams
  FOR INSERT
  TO public
  WITH CHECK (((SELECT auth.jwt()) ->> 'role') = 'service_role');

-- USAGE RECORDS
CREATE POLICY "Users can view own usage records"
  ON public.usage_records
  FOR SELECT
  TO public
  USING ((SELECT auth.uid()) = user_id);

-- ===========================================================================
-- Migration Complete
-- ===========================================================================
-- Expected improvements:
-- ✅ Removed ALL duplicate policies (old *_all and *_select naming)
-- ✅ 10 optimized SELECT policies with (SELECT auth.uid()) pattern
-- ✅ No multiple permissive policies per role/action
-- ✅ Same security model, optimized execution
