/*
  # Insert Default Subscription Plans

  1. Plans to Insert
    - Basic Plan (Free)
      - Price: R$ 0.00
      - Features: Basic recipe access
    
    - Premium Plan
      - Price: R$ 29.90
      - Features: AI mentoring, priority support, advanced features

  2. Security
    - Plans are publicly readable for authenticated users
*/

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price, currency, billing_period, features, is_active)
VALUES 
  (
    'Plano Básico',
    'Acesso básico às receitas e funcionalidades essenciais',
    0.00,
    'BRL',
    'monthly',
    '["basic_recipes", "favorites", "reviews"]'::jsonb,
    true
  ),
  (
    'Plano Premium',
    'Acesso completo com Mentoria IA, suporte prioritário e funcionalidades avançadas',
    29.90,
    'BRL',
    'monthly',
    '["basic_recipes", "favorites", "reviews", "ai_mentoring", "priority_support", "advanced_analytics"]'::jsonb,
    true
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  updated_at = now();