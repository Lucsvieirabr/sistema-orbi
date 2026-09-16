UPDATE public.subscription_plans
   SET description = 'Automatização e planejamento: IA classificadora, importação de extrato, Motor Preditivo, Projetos de Vida, Inflação Pessoal, orçamentos, metas e rateios.',
       updated_at = NOW()
 WHERE slug = 'pro';

UPDATE public.subscription_plans
   SET description = 'Tudo do Pro e mais um acesso: Projetos de Vida, Inflação Pessoal e todo o planejamento a dois, com uma única assinatura.',
       updated_at = NOW()
 WHERE slug = 'casal';
