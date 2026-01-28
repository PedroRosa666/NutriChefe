/*
  # Add Stripe billing integration fields

  1. Changes
    - Add `stripe_product_id` and `stripe_price_id` to `subscription_plans`
    - Add `stripe_customer_id` to `profiles`

  2. Notes
    - Safe to run multiple times due to IF NOT EXISTS checks
*/

-- Add stripe columns to subscription_plans
DO $$ BEGIN
  ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_product_id text;
  ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id text;
EXCEPTION WHEN undefined_table THEN
  -- table might not exist in some environments
  NULL;
END $$;

-- Add stripe_customer_id to profiles
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
