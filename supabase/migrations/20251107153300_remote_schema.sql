create extension if not exists "pg_net" with schema "public" version '0.19.5';

revoke delete on table "public"."auth_events" from "anon";

revoke insert on table "public"."auth_events" from "anon";

revoke references on table "public"."auth_events" from "anon";

revoke select on table "public"."auth_events" from "anon";

revoke trigger on table "public"."auth_events" from "anon";

revoke truncate on table "public"."auth_events" from "anon";

revoke update on table "public"."auth_events" from "anon";

revoke delete on table "public"."auth_events" from "authenticated";

revoke insert on table "public"."auth_events" from "authenticated";

revoke references on table "public"."auth_events" from "authenticated";

revoke select on table "public"."auth_events" from "authenticated";

revoke trigger on table "public"."auth_events" from "authenticated";

revoke truncate on table "public"."auth_events" from "authenticated";

revoke update on table "public"."auth_events" from "authenticated";

revoke delete on table "public"."auth_events" from "service_role";

revoke insert on table "public"."auth_events" from "service_role";

revoke references on table "public"."auth_events" from "service_role";

revoke select on table "public"."auth_events" from "service_role";

revoke trigger on table "public"."auth_events" from "service_role";

revoke truncate on table "public"."auth_events" from "service_role";

revoke update on table "public"."auth_events" from "service_role";

revoke delete on table "public"."daily_view_stats" from "anon";

revoke insert on table "public"."daily_view_stats" from "anon";

revoke references on table "public"."daily_view_stats" from "anon";

revoke select on table "public"."daily_view_stats" from "anon";

revoke trigger on table "public"."daily_view_stats" from "anon";

revoke truncate on table "public"."daily_view_stats" from "anon";

revoke update on table "public"."daily_view_stats" from "anon";

revoke delete on table "public"."daily_view_stats" from "authenticated";

revoke insert on table "public"."daily_view_stats" from "authenticated";

revoke references on table "public"."daily_view_stats" from "authenticated";

revoke select on table "public"."daily_view_stats" from "authenticated";

revoke trigger on table "public"."daily_view_stats" from "authenticated";

revoke truncate on table "public"."daily_view_stats" from "authenticated";

revoke update on table "public"."daily_view_stats" from "authenticated";

revoke delete on table "public"."daily_view_stats" from "service_role";

revoke insert on table "public"."daily_view_stats" from "service_role";

revoke references on table "public"."daily_view_stats" from "service_role";

revoke select on table "public"."daily_view_stats" from "service_role";

revoke trigger on table "public"."daily_view_stats" from "service_role";

revoke truncate on table "public"."daily_view_stats" from "service_role";

revoke update on table "public"."daily_view_stats" from "service_role";

revoke delete on table "public"."monthly_usage" from "anon";

revoke insert on table "public"."monthly_usage" from "anon";

revoke references on table "public"."monthly_usage" from "anon";

revoke select on table "public"."monthly_usage" from "anon";

revoke trigger on table "public"."monthly_usage" from "anon";

revoke truncate on table "public"."monthly_usage" from "anon";

revoke update on table "public"."monthly_usage" from "anon";

revoke delete on table "public"."monthly_usage" from "authenticated";

revoke insert on table "public"."monthly_usage" from "authenticated";

revoke references on table "public"."monthly_usage" from "authenticated";

revoke select on table "public"."monthly_usage" from "authenticated";

revoke trigger on table "public"."monthly_usage" from "authenticated";

revoke truncate on table "public"."monthly_usage" from "authenticated";

revoke update on table "public"."monthly_usage" from "authenticated";

revoke delete on table "public"."monthly_usage" from "service_role";

revoke insert on table "public"."monthly_usage" from "service_role";

revoke references on table "public"."monthly_usage" from "service_role";

revoke select on table "public"."monthly_usage" from "service_role";

revoke trigger on table "public"."monthly_usage" from "service_role";

revoke truncate on table "public"."monthly_usage" from "service_role";

revoke update on table "public"."monthly_usage" from "service_role";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke select on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke references on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."screenshots" from "anon";

revoke insert on table "public"."screenshots" from "anon";

revoke references on table "public"."screenshots" from "anon";

revoke select on table "public"."screenshots" from "anon";

revoke trigger on table "public"."screenshots" from "anon";

revoke truncate on table "public"."screenshots" from "anon";

revoke update on table "public"."screenshots" from "anon";

revoke delete on table "public"."screenshots" from "authenticated";

revoke insert on table "public"."screenshots" from "authenticated";

revoke references on table "public"."screenshots" from "authenticated";

revoke select on table "public"."screenshots" from "authenticated";

revoke trigger on table "public"."screenshots" from "authenticated";

revoke truncate on table "public"."screenshots" from "authenticated";

revoke update on table "public"."screenshots" from "authenticated";

revoke delete on table "public"."screenshots" from "service_role";

revoke insert on table "public"."screenshots" from "service_role";

revoke references on table "public"."screenshots" from "service_role";

revoke select on table "public"."screenshots" from "service_role";

revoke trigger on table "public"."screenshots" from "service_role";

revoke truncate on table "public"."screenshots" from "service_role";

revoke update on table "public"."screenshots" from "service_role";

revoke delete on table "public"."stripe_events" from "anon";

revoke insert on table "public"."stripe_events" from "anon";

revoke references on table "public"."stripe_events" from "anon";

revoke select on table "public"."stripe_events" from "anon";

revoke trigger on table "public"."stripe_events" from "anon";

revoke truncate on table "public"."stripe_events" from "anon";

revoke update on table "public"."stripe_events" from "anon";

revoke delete on table "public"."stripe_events" from "authenticated";

revoke insert on table "public"."stripe_events" from "authenticated";

revoke references on table "public"."stripe_events" from "authenticated";

revoke select on table "public"."stripe_events" from "authenticated";

revoke trigger on table "public"."stripe_events" from "authenticated";

revoke truncate on table "public"."stripe_events" from "authenticated";

revoke update on table "public"."stripe_events" from "authenticated";

revoke delete on table "public"."stripe_events" from "service_role";

revoke insert on table "public"."stripe_events" from "service_role";

revoke references on table "public"."stripe_events" from "service_role";

revoke select on table "public"."stripe_events" from "service_role";

revoke trigger on table "public"."stripe_events" from "service_role";

revoke truncate on table "public"."stripe_events" from "service_role";

revoke update on table "public"."stripe_events" from "service_role";

revoke delete on table "public"."upload_sessions" from "anon";

revoke insert on table "public"."upload_sessions" from "anon";

revoke references on table "public"."upload_sessions" from "anon";

revoke select on table "public"."upload_sessions" from "anon";

revoke trigger on table "public"."upload_sessions" from "anon";

revoke truncate on table "public"."upload_sessions" from "anon";

revoke update on table "public"."upload_sessions" from "anon";

revoke delete on table "public"."upload_sessions" from "authenticated";

revoke insert on table "public"."upload_sessions" from "authenticated";

revoke references on table "public"."upload_sessions" from "authenticated";

revoke select on table "public"."upload_sessions" from "authenticated";

revoke trigger on table "public"."upload_sessions" from "authenticated";

revoke truncate on table "public"."upload_sessions" from "authenticated";

revoke update on table "public"."upload_sessions" from "authenticated";

revoke delete on table "public"."upload_sessions" from "service_role";

revoke insert on table "public"."upload_sessions" from "service_role";

revoke references on table "public"."upload_sessions" from "service_role";

revoke select on table "public"."upload_sessions" from "service_role";

revoke trigger on table "public"."upload_sessions" from "service_role";

revoke truncate on table "public"."upload_sessions" from "service_role";

revoke update on table "public"."upload_sessions" from "service_role";

revoke delete on table "public"."view_events" from "anon";

revoke insert on table "public"."view_events" from "anon";

revoke references on table "public"."view_events" from "anon";

revoke select on table "public"."view_events" from "anon";

revoke trigger on table "public"."view_events" from "anon";

revoke truncate on table "public"."view_events" from "anon";

revoke update on table "public"."view_events" from "anon";

revoke delete on table "public"."view_events" from "authenticated";

revoke insert on table "public"."view_events" from "authenticated";

revoke references on table "public"."view_events" from "authenticated";

revoke select on table "public"."view_events" from "authenticated";

revoke trigger on table "public"."view_events" from "authenticated";

revoke truncate on table "public"."view_events" from "authenticated";

revoke update on table "public"."view_events" from "authenticated";

revoke delete on table "public"."view_events" from "service_role";

revoke insert on table "public"."view_events" from "service_role";

revoke references on table "public"."view_events" from "service_role";

revoke select on table "public"."view_events" from "service_role";

revoke trigger on table "public"."view_events" from "service_role";

revoke truncate on table "public"."view_events" from "service_role";

revoke update on table "public"."view_events" from "service_role";

create table "public"."credit_balances" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "current_balance" integer default 0,
    "transactions" jsonb default '[]'::jsonb,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."credit_balances" enable row level security;

create table "public"."dunning_attempts" (
    "id" uuid not null default gen_random_uuid(),
    "subscription_id" uuid not null,
    "attempt_number" integer not null,
    "attempt_date" timestamp with time zone not null,
    "payment_result" text not null,
    "failure_reason" text,
    "next_retry_date" timestamp with time zone,
    "notification_sent" boolean default false,
    "notification_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."dunning_attempts" enable row level security;

create table "public"."invoices" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "subscription_id" uuid,
    "stripe_invoice_id" text not null,
    "stripe_hosted_invoice_url" text,
    "stripe_invoice_pdf" text,
    "invoice_number" text not null,
    "status" text not null,
    "subtotal" integer not null,
    "tax" integer default 0,
    "total" integer not null,
    "amount_paid" integer default 0,
    "amount_due" integer not null,
    "line_items" jsonb not null,
    "period_start" timestamp with time zone not null,
    "period_end" timestamp with time zone not null,
    "due_date" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."invoices" enable row level security;

create table "public"."payment_methods" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "stripe_payment_method_id" text not null,
    "card_brand" text,
    "card_last4" text,
    "card_exp_month" integer,
    "card_exp_year" integer,
    "billing_address" jsonb,
    "is_default" boolean default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."payment_methods" enable row level security;

create table "public"."stripe_customers" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "stripe_customer_id" text not null,
    "email" text not null,
    "name" text,
    "default_payment_method_id" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."stripe_customers" enable row level security;

create table "public"."subscription_events" (
    "id" uuid not null default gen_random_uuid(),
    "subscription_id" uuid not null,
    "user_id" uuid not null,
    "event_type" text not null,
    "previous_plan" text,
    "new_plan" text,
    "previous_status" text,
    "new_status" text,
    "reason" text,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now()
);


alter table "public"."subscription_events" enable row level security;

create table "public"."subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "stripe_subscription_id" text not null,
    "stripe_customer_id" text not null,
    "stripe_price_id" text not null,
    "plan_type" text not null,
    "billing_cycle" text not null,
    "status" text not null,
    "current_period_start" timestamp with time zone not null,
    "current_period_end" timestamp with time zone not null,
    "trial_end" timestamp with time zone,
    "cancel_at_period_end" boolean default false,
    "canceled_at" timestamp with time zone,
    "seat_count" integer,
    "team_id" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."subscriptions" enable row level security;

create table "public"."team_members" (
    "id" uuid not null default gen_random_uuid(),
    "team_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null default 'member'::text,
    "status" text not null default 'pending'::text,
    "invitation_token" text,
    "invitation_expires_at" timestamp with time zone,
    "invited_at" timestamp with time zone default now(),
    "joined_at" timestamp with time zone,
    "removed_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."team_members" enable row level security;

create table "public"."teams" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "admin_user_id" uuid not null,
    "subscription_id" uuid,
    "seat_count" integer not null,
    "filled_seats" integer default 1,
    "billing_email" text,
    "company_name" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."teams" enable row level security;

create table "public"."usage_records" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "period_start" timestamp with time zone not null,
    "period_end" timestamp with time zone not null,
    "screenshot_count" integer default 0,
    "storage_bytes" bigint default 0,
    "bandwidth_bytes" bigint default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."usage_records" enable row level security;

CREATE UNIQUE INDEX credit_balances_pkey ON public.credit_balances USING btree (id);

CREATE UNIQUE INDEX credit_balances_user_id_key ON public.credit_balances USING btree (user_id);

CREATE UNIQUE INDEX dunning_attempts_pkey ON public.dunning_attempts USING btree (id);

CREATE UNIQUE INDEX dunning_attempts_subscription_id_attempt_number_key ON public.dunning_attempts USING btree (subscription_id, attempt_number);

CREATE INDEX idx_credit_balances_expiring ON public.credit_balances USING btree (expires_at) WHERE (expires_at IS NOT NULL);

CREATE INDEX idx_credit_balances_user ON public.credit_balances USING btree (user_id);

CREATE INDEX idx_dunning_attempts_next_retry ON public.dunning_attempts USING btree (next_retry_date) WHERE (payment_result = 'failed'::text);

CREATE INDEX idx_dunning_attempts_subscription ON public.dunning_attempts USING btree (subscription_id);

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);

CREATE INDEX idx_invoices_stripe ON public.invoices USING btree (stripe_invoice_id);

CREATE INDEX idx_invoices_subscription ON public.invoices USING btree (subscription_id);

CREATE INDEX idx_invoices_user ON public.invoices USING btree (user_id);

CREATE INDEX idx_payment_methods_default ON public.payment_methods USING btree (user_id, is_default) WHERE (is_default = true);

CREATE INDEX idx_payment_methods_user ON public.payment_methods USING btree (user_id);

CREATE UNIQUE INDEX idx_stripe_customers_stripe_id ON public.stripe_customers USING btree (stripe_customer_id);

CREATE INDEX idx_stripe_customers_user ON public.stripe_customers USING btree (user_id);

CREATE INDEX idx_subscription_events_subscription ON public.subscription_events USING btree (subscription_id, created_at DESC);

CREATE INDEX idx_subscription_events_type ON public.subscription_events USING btree (event_type, created_at DESC);

CREATE INDEX idx_subscription_events_user ON public.subscription_events USING btree (user_id, created_at DESC);

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status) WHERE (status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text]));

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions USING btree (stripe_customer_id);

CREATE INDEX idx_subscriptions_trial_end ON public.subscriptions USING btree (trial_end) WHERE (trial_end IS NOT NULL);

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);

CREATE INDEX idx_team_members_invitation ON public.team_members USING btree (invitation_token) WHERE (status = 'pending'::text);

CREATE INDEX idx_team_members_status ON public.team_members USING btree (team_id, status) WHERE (status = 'active'::text);

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id);

CREATE INDEX idx_teams_admin ON public.teams USING btree (admin_user_id);

CREATE INDEX idx_teams_subscription ON public.teams USING btree (subscription_id);

CREATE INDEX idx_usage_records_period ON public.usage_records USING btree (user_id, period_start, period_end);

CREATE INDEX idx_usage_records_user ON public.usage_records USING btree (user_id);

CREATE UNIQUE INDEX invoices_invoice_number_key ON public.invoices USING btree (invoice_number);

CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id);

CREATE UNIQUE INDEX invoices_stripe_invoice_id_key ON public.invoices USING btree (stripe_invoice_id);

CREATE UNIQUE INDEX payment_methods_pkey ON public.payment_methods USING btree (id);

CREATE UNIQUE INDEX payment_methods_stripe_payment_method_id_key ON public.payment_methods USING btree (stripe_payment_method_id);

CREATE UNIQUE INDEX stripe_customers_pkey ON public.stripe_customers USING btree (id);

CREATE UNIQUE INDEX stripe_customers_stripe_customer_id_key ON public.stripe_customers USING btree (stripe_customer_id);

CREATE UNIQUE INDEX stripe_customers_user_id_key ON public.stripe_customers USING btree (user_id);

CREATE UNIQUE INDEX subscription_events_pkey ON public.subscription_events USING btree (id);

CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);

CREATE UNIQUE INDEX subscriptions_stripe_subscription_id_key ON public.subscriptions USING btree (stripe_subscription_id);

CREATE UNIQUE INDEX team_members_invitation_token_key ON public.team_members USING btree (invitation_token);

CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (id);

CREATE UNIQUE INDEX team_members_team_id_user_id_key ON public.team_members USING btree (team_id, user_id);

CREATE UNIQUE INDEX teams_pkey ON public.teams USING btree (id);

CREATE UNIQUE INDEX teams_subscription_id_key ON public.teams USING btree (subscription_id);

CREATE UNIQUE INDEX usage_records_pkey ON public.usage_records USING btree (id);

CREATE UNIQUE INDEX usage_records_user_id_period_start_key ON public.usage_records USING btree (user_id, period_start);

alter table "public"."credit_balances" add constraint "credit_balances_pkey" PRIMARY KEY using index "credit_balances_pkey";

alter table "public"."dunning_attempts" add constraint "dunning_attempts_pkey" PRIMARY KEY using index "dunning_attempts_pkey";

alter table "public"."invoices" add constraint "invoices_pkey" PRIMARY KEY using index "invoices_pkey";

alter table "public"."payment_methods" add constraint "payment_methods_pkey" PRIMARY KEY using index "payment_methods_pkey";

alter table "public"."stripe_customers" add constraint "stripe_customers_pkey" PRIMARY KEY using index "stripe_customers_pkey";

alter table "public"."subscription_events" add constraint "subscription_events_pkey" PRIMARY KEY using index "subscription_events_pkey";

alter table "public"."subscriptions" add constraint "subscriptions_pkey" PRIMARY KEY using index "subscriptions_pkey";

alter table "public"."team_members" add constraint "team_members_pkey" PRIMARY KEY using index "team_members_pkey";

alter table "public"."teams" add constraint "teams_pkey" PRIMARY KEY using index "teams_pkey";

alter table "public"."usage_records" add constraint "usage_records_pkey" PRIMARY KEY using index "usage_records_pkey";

alter table "public"."credit_balances" add constraint "credit_balances_current_balance_check" CHECK ((current_balance >= 0)) not valid;

alter table "public"."credit_balances" validate constraint "credit_balances_current_balance_check";

alter table "public"."credit_balances" add constraint "credit_balances_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."credit_balances" validate constraint "credit_balances_user_id_fkey";

alter table "public"."credit_balances" add constraint "credit_balances_user_id_key" UNIQUE using index "credit_balances_user_id_key";

alter table "public"."dunning_attempts" add constraint "dunning_attempts_attempt_number_check" CHECK (((attempt_number >= 1) AND (attempt_number <= 3))) not valid;

alter table "public"."dunning_attempts" validate constraint "dunning_attempts_attempt_number_check";

alter table "public"."dunning_attempts" add constraint "dunning_attempts_payment_result_check" CHECK ((payment_result = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text]))) not valid;

alter table "public"."dunning_attempts" validate constraint "dunning_attempts_payment_result_check";

alter table "public"."dunning_attempts" add constraint "dunning_attempts_subscription_id_attempt_number_key" UNIQUE using index "dunning_attempts_subscription_id_attempt_number_key";

alter table "public"."dunning_attempts" add constraint "dunning_attempts_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE not valid;

alter table "public"."dunning_attempts" validate constraint "dunning_attempts_subscription_id_fkey";

alter table "public"."invoices" add constraint "invoices_invoice_number_key" UNIQUE using index "invoices_invoice_number_key";

alter table "public"."invoices" add constraint "invoices_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'paid'::text, 'void'::text, 'uncollectible'::text]))) not valid;

alter table "public"."invoices" validate constraint "invoices_status_check";

alter table "public"."invoices" add constraint "invoices_stripe_invoice_id_key" UNIQUE using index "invoices_stripe_invoice_id_key";

alter table "public"."invoices" add constraint "invoices_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL not valid;

alter table "public"."invoices" validate constraint "invoices_subscription_id_fkey";

alter table "public"."invoices" add constraint "invoices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."invoices" validate constraint "invoices_user_id_fkey";

alter table "public"."payment_methods" add constraint "payment_methods_stripe_payment_method_id_key" UNIQUE using index "payment_methods_stripe_payment_method_id_key";

alter table "public"."payment_methods" add constraint "payment_methods_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."payment_methods" validate constraint "payment_methods_user_id_fkey";

alter table "public"."stripe_customers" add constraint "stripe_customers_stripe_customer_id_key" UNIQUE using index "stripe_customers_stripe_customer_id_key";

alter table "public"."stripe_customers" add constraint "stripe_customers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."stripe_customers" validate constraint "stripe_customers_user_id_fkey";

alter table "public"."stripe_customers" add constraint "stripe_customers_user_id_key" UNIQUE using index "stripe_customers_user_id_key";

alter table "public"."subscription_events" add constraint "subscription_events_event_type_check" CHECK ((event_type = ANY (ARRAY['created'::text, 'trial_started'::text, 'trial_converted'::text, 'trial_canceled'::text, 'upgraded'::text, 'downgraded'::text, 'canceled'::text, 'reactivated'::text, 'payment_succeeded'::text, 'payment_failed'::text, 'suspended'::text, 'resumed'::text]))) not valid;

alter table "public"."subscription_events" validate constraint "subscription_events_event_type_check";

alter table "public"."subscription_events" add constraint "subscription_events_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE not valid;

alter table "public"."subscription_events" validate constraint "subscription_events_subscription_id_fkey";

alter table "public"."subscription_events" add constraint "subscription_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."subscription_events" validate constraint "subscription_events_user_id_fkey";

alter table "public"."subscriptions" add constraint "fk_subscriptions_team" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL not valid;

alter table "public"."subscriptions" validate constraint "fk_subscriptions_team";

alter table "public"."subscriptions" add constraint "subscriptions_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text]))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_billing_cycle_check";

alter table "public"."subscriptions" add constraint "subscriptions_plan_type_check" CHECK ((plan_type = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text]))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_plan_type_check";

alter table "public"."subscriptions" add constraint "subscriptions_seat_count_check" CHECK (((seat_count IS NULL) OR (seat_count >= 3))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_seat_count_check";

alter table "public"."subscriptions" add constraint "subscriptions_status_check" CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'suspended'::text]))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_status_check";

alter table "public"."subscriptions" add constraint "subscriptions_stripe_subscription_id_key" UNIQUE using index "subscriptions_stripe_subscription_id_key";

alter table "public"."subscriptions" add constraint "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_user_id_fkey";

alter table "public"."subscriptions" add constraint "valid_team_subscription" CHECK ((((plan_type = 'team'::text) AND (seat_count IS NOT NULL) AND (team_id IS NOT NULL)) OR ((plan_type <> 'team'::text) AND (seat_count IS NULL) AND (team_id IS NULL)))) not valid;

alter table "public"."subscriptions" validate constraint "valid_team_subscription";

alter table "public"."team_members" add constraint "team_members_invitation_token_key" UNIQUE using index "team_members_invitation_token_key";

alter table "public"."team_members" add constraint "team_members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text]))) not valid;

alter table "public"."team_members" validate constraint "team_members_role_check";

alter table "public"."team_members" add constraint "team_members_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'removed'::text]))) not valid;

alter table "public"."team_members" validate constraint "team_members_status_check";

alter table "public"."team_members" add constraint "team_members_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_team_id_fkey";

alter table "public"."team_members" add constraint "team_members_team_id_user_id_key" UNIQUE using index "team_members_team_id_user_id_key";

alter table "public"."team_members" add constraint "team_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_user_id_fkey";

alter table "public"."teams" add constraint "fk_teams_subscription" FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL not valid;

alter table "public"."teams" validate constraint "fk_teams_subscription";

alter table "public"."teams" add constraint "teams_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES profiles(id) ON DELETE RESTRICT not valid;

alter table "public"."teams" validate constraint "teams_admin_user_id_fkey";

alter table "public"."teams" add constraint "teams_check" CHECK (((filled_seats >= 1) AND (filled_seats <= seat_count))) not valid;

alter table "public"."teams" validate constraint "teams_check";

alter table "public"."teams" add constraint "teams_seat_count_check" CHECK ((seat_count >= 3)) not valid;

alter table "public"."teams" validate constraint "teams_seat_count_check";

alter table "public"."teams" add constraint "teams_subscription_id_key" UNIQUE using index "teams_subscription_id_key";

alter table "public"."usage_records" add constraint "usage_records_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."usage_records" validate constraint "usage_records_user_id_fkey";

alter table "public"."usage_records" add constraint "usage_records_user_id_period_start_key" UNIQUE using index "usage_records_user_id_period_start_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_upload_quota(p_user_id uuid)
 RETURNS TABLE(allowed boolean, current_count integer, quota_limit integer, plan_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_plan TEXT;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_current_count INTEGER;
  v_quota_limit INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM profiles WHERE id = p_user_id;

  CASE v_plan
    WHEN 'free' THEN v_quota_limit := 10;
    WHEN 'pro' THEN v_quota_limit := NULL;
    WHEN 'team' THEN v_quota_limit := NULL;
  END CASE;

  SELECT
    current_period_start,
    current_period_end
  INTO v_period_start, v_period_end
  FROM subscriptions
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_period_start IS NULL THEN
    v_period_start := DATE_TRUNC('month', NOW());
    v_period_end := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month');
  END IF;

  SELECT COALESCE(screenshot_count, 0)
  INTO v_current_count
  FROM usage_records
  WHERE user_id = p_user_id
  AND period_start = v_period_start;

  RETURN QUERY SELECT
    (v_quota_limit IS NULL OR v_current_count < v_quota_limit) AS allowed,
    v_current_count AS current_count,
    v_quota_limit AS quota_limit,
    v_plan AS plan_type;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invoke_cleanup_edge_function()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  request_id BIGINT;
  project_url TEXT;
  service_key TEXT;
BEGIN
  -- Retrieve project URL and service role key from vault
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url';

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  -- Check if secrets are configured
  IF project_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Cleanup job skipped: project_url or service_role_key not configured in vault';
    RETURN;
  END IF;

  -- Invoke the cleanup-expired Edge Function via HTTP POST
  SELECT net.http_post(
    url := project_url || '/functions/v1/cleanup-expired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'timestamp', now()::text
    ),
    timeout_milliseconds := 30000 -- 30 second timeout for cleanup operation
  ) INTO request_id;

  RAISE NOTICE 'Cleanup Edge Function invoked with request_id: %', request_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_profile_plan()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status IN ('active', 'trialing') THEN
    UPDATE profiles
    SET plan = NEW.plan_type
    WHERE id = NEW.user_id;
  ELSIF NEW.status IN ('canceled', 'suspended') THEN
    UPDATE profiles
    SET plan = 'free'
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_team_filled_seats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_upload_quota()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_count INTEGER;
  user_plan TEXT;
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');

  -- Get user plan with row lock
  SELECT plan INTO user_plan FROM profiles WHERE id = NEW.user_id FOR UPDATE;

  -- Only enforce quota for free users
  IF user_plan = 'free' THEN
    -- Get current month's count with row lock (prevents race conditions)
    SELECT COALESCE(screenshot_count, 0) INTO current_count
    FROM monthly_usage
    WHERE user_id = NEW.user_id AND month = current_month
    FOR UPDATE;

    IF current_count >= 10 THEN
      RAISE EXCEPTION 'Monthly quota exceeded. Upgrade to Pro for unlimited uploads.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_user_data(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  screenshots_deleted integer;
  monthly_usage_deleted integer;
  auth_events_deleted integer;
  profile_deleted integer;
  screenshot_paths text[];
BEGIN
  -- All operations within this function are in a single transaction
  -- If any operation fails, PostgreSQL automatically rolls back all changes
  
  -- 1. Fetch screenshot storage paths BEFORE deleting (for storage cleanup)
  SELECT array_agg(storage_path) INTO screenshot_paths
  FROM screenshots
  WHERE user_id = target_user_id;
  
  -- 2. Delete screenshots metadata
  DELETE FROM screenshots 
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS screenshots_deleted = ROW_COUNT;
  
  -- 3. Delete monthly_usage records
  DELETE FROM monthly_usage 
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS monthly_usage_deleted = ROW_COUNT;
  
  -- 4. Delete auth_events records
  DELETE FROM auth_events 
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS auth_events_deleted = ROW_COUNT;
  
  -- 5. Delete profile record
  DELETE FROM profiles 
  WHERE id = target_user_id;
  GET DIAGNOSTICS profile_deleted = ROW_COUNT;
  
  -- Return deletion summary including storage paths for cleanup
  RETURN jsonb_build_object(
    'screenshots_deleted', screenshots_deleted,
    'monthly_usage_deleted', monthly_usage_deleted,
    'auth_events_deleted', auth_events_deleted,
    'profile_deleted', profile_deleted,
    'storage_paths', COALESCE(screenshot_paths, ARRAY[]::text[])
  );
  
  -- If any operation fails, PostgreSQL automatically rolls back all changes
  EXCEPTION WHEN OTHERS THEN
    -- Re-raise the exception to trigger rollback
    RAISE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'free',
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error and re-raise to rollback auth.users insert
  RAISE EXCEPTION 'Failed to create profile for user %: %', NEW.id, SQLERRM;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_view_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Increment view counter atomically
  UPDATE screenshots
  SET views = views + 1
  WHERE id = NEW.screenshot_id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_monthly_usage_on_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  screenshot_month TEXT;
BEGIN
  screenshot_month := to_char(OLD.created_at, 'YYYY-MM');

  UPDATE monthly_usage
  SET
    screenshot_count = screenshot_count - 1,
    storage_bytes = storage_bytes - OLD.file_size
  WHERE user_id = OLD.user_id AND month = screenshot_month;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_monthly_usage_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');

  INSERT INTO monthly_usage (user_id, month, screenshot_count, storage_bytes)
  VALUES (NEW.user_id, current_month, 1, NEW.file_size)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    screenshot_count = monthly_usage.screenshot_count + 1,
    storage_bytes = monthly_usage.storage_bytes + NEW.file_size;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_user_password(user_email text, user_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public', 'pg_temp'
AS $function$
DECLARE
  user_record RECORD;
BEGIN
  -- Get user record by email from auth.users
  SELECT * INTO user_record
  FROM auth.users
  WHERE email = user_email
  AND deleted_at IS NULL;
  
  -- Return false if user not found
  IF user_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verify password using crypt (bcrypt comparison)
  -- The encrypted_password column stores bcrypt hashes
  -- crypt() is provided by the pgcrypto extension
  RETURN (user_record.encrypted_password = crypt(user_password, user_record.encrypted_password));
END;
$function$
;

create policy "Service role can manage all credit balances"
on "public"."credit_balances"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can view own credit balance"
on "public"."credit_balances"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Service role can manage all dunning attempts"
on "public"."dunning_attempts"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can view own dunning attempts"
on "public"."dunning_attempts"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM subscriptions
  WHERE ((subscriptions.id = dunning_attempts.subscription_id) AND (subscriptions.user_id = auth.uid())))));


create policy "Service role can manage all invoices"
on "public"."invoices"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can view own invoices"
on "public"."invoices"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Service role can manage all payment methods"
on "public"."payment_methods"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can view own payment methods"
on "public"."payment_methods"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Service role can manage all Stripe customers"
on "public"."stripe_customers"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can view own Stripe customer"
on "public"."stripe_customers"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Service role can manage all subscription events"
on "public"."subscription_events"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can view own subscription events"
on "public"."subscription_events"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Service role can manage all subscriptions"
on "public"."subscriptions"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can view own subscriptions"
on "public"."subscriptions"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Service role can manage all team members"
on "public"."team_members"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Team members can view team membership"
on "public"."team_members"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM teams
  WHERE ((teams.id = team_members.team_id) AND ((teams.admin_user_id = auth.uid()) OR (team_members.user_id = auth.uid()))))));


create policy "Service role can manage all teams"
on "public"."teams"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Service role for teams insert"
on "public"."teams"
as permissive
for insert
to public
with check (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Team admin can manage team"
on "public"."teams"
as permissive
for update
to public
using ((auth.uid() = admin_user_id));


create policy "Team members can view their team"
on "public"."teams"
as permissive
for select
to public
using (((auth.uid() = admin_user_id) OR (EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.team_id = teams.id) AND (team_members.user_id = auth.uid()) AND (team_members.status = 'active'::text))))));


create policy "Service role can manage all usage records"
on "public"."usage_records"
as permissive
for all
to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


create policy "Users can view own usage records"
on "public"."usage_records"
as permissive
for select
to public
using ((auth.uid() = user_id));


CREATE TRIGGER update_credit_balances_updated_at BEFORE UPDATE ON public.credit_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_dunning_attempts_updated_at BEFORE UPDATE ON public.dunning_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stripe_customers_updated_at BEFORE UPDATE ON public.stripe_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sync_profile_plan_insert AFTER INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION sync_profile_plan();

CREATE TRIGGER sync_profile_plan_update AFTER UPDATE OF status, plan_type ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION sync_profile_plan();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sync_team_filled_seats_delete AFTER DELETE ON public.team_members FOR EACH ROW EXECUTE FUNCTION sync_team_filled_seats();

CREATE TRIGGER sync_team_filled_seats_insert AFTER INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION sync_team_filled_seats();

CREATE TRIGGER sync_team_filled_seats_update AFTER UPDATE OF status ON public.team_members FOR EACH ROW EXECUTE FUNCTION sync_team_filled_seats();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_usage_records_updated_at BEFORE UPDATE ON public.usage_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();



