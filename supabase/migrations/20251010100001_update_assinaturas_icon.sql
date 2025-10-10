-- Migration: Atualizar ícone da categoria Assinaturas
-- Altera o ícone de 'subscription' para 'captions' do Lucide

BEGIN;

-- Atualizar o ícone da categoria Assinaturas para 'captions'
UPDATE public.categories 
SET icon = 'captions'
WHERE name = 'Assinaturas' 
  AND is_system = TRUE;

COMMIT;

