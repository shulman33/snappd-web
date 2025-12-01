-- Migration: Optimize RLS Policies for Performance
-- Issue: Auth functions (auth.uid(), auth.jwt()) are being re-evaluated for each row
-- Fix: Wrap auth functions in subqueries to evaluate once per query
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan

-- ============================================================================
-- 1. CREDIT_BALANCES
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all credit balances" ON credit_balances;
DROP POLICY IF EXISTS "Users can view own credit balance" ON credit_balances;

CREATE POLICY "Service role can manage all credit balances"
ON credit_balances
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users can view own credit balance"
ON credit_balances
FOR SELECT
TO public
USING (((select auth.uid()) = user_id));

-- ============================================================================
-- 2. DUNNING_ATTEMPTS
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all dunning attempts" ON dunning_attempts;
DROP POLICY IF EXISTS "Users can view own dunning attempts" ON dunning_attempts;

CREATE POLICY "Service role can manage all dunning attempts"
ON dunning_attempts
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users can view own dunning attempts"
ON dunning_attempts
FOR SELECT
TO public
USING ((EXISTS (
  SELECT 1
  FROM subscriptions
  WHERE ((subscriptions.id = dunning_attempts.subscription_id)
    AND (subscriptions.user_id = (select auth.uid())))
)));

-- ============================================================================
-- 3. INVOICES
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;

CREATE POLICY "Service role can manage all invoices"
ON invoices
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users can view own invoices"
ON invoices
FOR SELECT
TO public
USING (((select auth.uid()) = user_id));

-- ============================================================================
-- 4. PAYMENT_METHODS
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can view own payment methods" ON payment_methods;

CREATE POLICY "Service role can manage all payment methods"
ON payment_methods
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users can view own payment methods"
ON payment_methods
FOR SELECT
TO public
USING (((select auth.uid()) = user_id));

-- ============================================================================
-- 5. STRIPE_CUSTOMERS
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all Stripe customers" ON stripe_customers;
DROP POLICY IF EXISTS "Users can view own Stripe customer" ON stripe_customers;

CREATE POLICY "Service role can manage all Stripe customers"
ON stripe_customers
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users can view own Stripe customer"
ON stripe_customers
FOR SELECT
TO public
USING (((select auth.uid()) = user_id));

-- ============================================================================
-- 6. SUBSCRIPTION_EVENTS
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all subscription events" ON subscription_events;
DROP POLICY IF EXISTS "Users can view own subscription events" ON subscription_events;

CREATE POLICY "Service role can manage all subscription events"
ON subscription_events
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users can view own subscription events"
ON subscription_events
FOR SELECT
TO public
USING (((select auth.uid()) = user_id));

-- ============================================================================
-- 7. SUBSCRIPTIONS
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;

CREATE POLICY "Service role can manage all subscriptions"
ON subscriptions
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users can view own subscriptions"
ON subscriptions
FOR SELECT
TO public
USING (((select auth.uid()) = user_id));

-- ============================================================================
-- 8. TEAM_MEMBERS
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all team members" ON team_members;
DROP POLICY IF EXISTS "Team members can view team membership" ON team_members;

CREATE POLICY "Service role can manage all team members"
ON team_members
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Team members can view team membership"
ON team_members
FOR SELECT
TO public
USING ((EXISTS (
  SELECT 1
  FROM teams
  WHERE ((teams.id = team_members.team_id)
    AND ((teams.admin_user_id = (select auth.uid()))
      OR (team_members.user_id = (select auth.uid()))))
)));

-- ============================================================================
-- 9. TEAMS
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all teams" ON teams;
DROP POLICY IF EXISTS "Service role for teams insert" ON teams;
DROP POLICY IF EXISTS "Team admin can manage team" ON teams;
DROP POLICY IF EXISTS "Team members can view their team" ON teams;

CREATE POLICY "Service role can manage all teams"
ON teams
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Service role for teams insert"
ON teams
FOR INSERT
TO public
WITH CHECK ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Team admin can manage team"
ON teams
FOR UPDATE
TO public
USING (((select auth.uid()) = admin_user_id));

CREATE POLICY "Team members can view their team"
ON teams
FOR SELECT
TO public
USING ((((select auth.uid()) = admin_user_id)
  OR (EXISTS (
    SELECT 1
    FROM team_members
    WHERE ((team_members.team_id = teams.id)
      AND (team_members.user_id = (select auth.uid())))
  ))));

-- ============================================================================
-- 10. USAGE_RECORDS
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage all usage records" ON usage_records;
DROP POLICY IF EXISTS "Users can view own usage records" ON usage_records;

CREATE POLICY "Service role can manage all usage records"
ON usage_records
FOR ALL
TO public
USING ((((select auth.jwt()) ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users can view own usage records"
ON usage_records
FOR SELECT
TO public
USING (((select auth.uid()) = user_id));

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Optimized 28 RLS policy clauses across 10 tables
-- All auth.uid() calls now wrapped in (select auth.uid())
-- All auth.jwt() calls now wrapped in (select auth.jwt())
-- Expected result: Significant performance improvement for multi-row queries
