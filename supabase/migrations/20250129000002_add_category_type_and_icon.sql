-- Migration: Add category_type and icon fields to categories table

BEGIN;

-- Add new columns to categories table
ALTER TABLE public.categories
  ADD COLUMN category_type text NOT NULL DEFAULT 'expense' CHECK (category_type IN ('income', 'expense')),
  ADD COLUMN icon text;

-- Update existing categories to have proper types
-- This is a best guess based on typical category names
UPDATE public.categories
SET category_type = CASE
  WHEN name ILIKE '%salário%' OR name ILIKE '%renda%' OR name ILIKE '%freelance%' OR name ILIKE '%invest%' OR name ILIKE '%dividend%' THEN 'income'
  ELSE 'expense'
END;

-- Add appropriate icons for existing categories
UPDATE public.categories
SET icon = CASE
  WHEN category_type = 'income' THEN
    CASE
      WHEN name ILIKE '%salário%' OR name ILIKE '%renda%' THEN 'fa-briefcase'
      WHEN name ILIKE '%freelance%' OR name ILIKE '%extra%' THEN 'fa-dollar-sign'
      WHEN name ILIKE '%invest%' THEN 'fa-chart-line'
      ELSE 'fa-money-bill-wave'
    END
  ELSE
    CASE
      WHEN name ILIKE '%moradia%' OR name ILIKE '%aluguel%' OR name ILIKE '%casa%' THEN 'fa-home'
      WHEN name ILIKE '%aliment%' OR name ILIKE '%super%' OR name ILIKE '%restaurante%' THEN 'fa-utensils'
      WHEN name ILIKE '%transport%' OR name ILIKE '%gasolin%' OR name ILIKE '%uber%' THEN 'fa-car'
      WHEN name ILIKE '%saúde%' OR name ILIKE '%medic%' OR name ILIKE '%farmácia%' THEN 'fa-heartbeat'
      WHEN name ILIKE '%educação%' OR name ILIKE '%curso%' OR name ILIKE '%escola%' THEN 'fa-graduation-cap'
      WHEN name ILIKE '%lazer%' OR name ILIKE '%viagem%' OR name ILIKE '%cinema%' THEN 'fa-plane'
      WHEN name ILIKE '%pessoal%' OR name ILIKE '%roupa%' OR name ILIKE '%presente%' THEN 'fa-shopping-bag'
      WHEN name ILIKE '%impost%' OR name ILIKE '%taxa%' OR name ILIKE '%juro%' THEN 'fa-file-invoice-dollar'
      ELSE 'fa-question-circle'
    END
END;

COMMIT;
