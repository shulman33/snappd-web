-- Performance Optimization: Add Missing Foreign Key Index
-- Based on Supabase Performance Advisor recommendation
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

-- Fix: Unindexed foreign key on subscriptions.team_id
-- Impact: Improves JOIN performance between subscriptions and teams tables
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) since migration system uses transactions

CREATE INDEX IF NOT EXISTS idx_subscriptions_team_id
ON public.subscriptions(team_id);
