# 🚀 Sistema de Features - Guia de Uso

Este documento mostra como usar o sistema de features/permissões expansivo do Orbi.

## 📋 Índice

1. [Adicionar Novas Features](#adicionar-novas-features)
2. [Usar Features em Componentes](#usar-features-em-componentes)
3. [Proteger Rotas](#proteger-rotas)
4. [Verificar Limites](#verificar-limites)
5. [Adicionar Features ao Plano Admin](#adicionar-features-ao-plano-admin)

---

## 1. Adicionar Novas Features

Quando você criar uma nova tela ou entidade, registre suas features em `orbi-features.ts`:

```typescript
// src/lib/features/orbi-features.ts

featureRegistry.registerFeatures([
  // Nova feature de sua tela/entidade
  defineFeature(
    'investments_view',           // Key único
    'Visualizar Investimentos',   // Nome amigável
    'Visualizar carteira de investimentos', // Descrição
    'financial',                  // Categoria
    { route: '/sistema/investments' } // Rota (opcional)
  ),
  defineFeature(
    'investments_create',
    'Criar Investimentos',
    'Adicionar novos investimentos',
    'financial',
    { dependencies: ['investments_view'] } // Depende de outra feature
  ),
]);

// Adicionar limites relacionados
featureRegistry.registerLimits([
  defineLimit(
    'max_investments',            // Key único
    'Máximo de Investimentos',    // Nome amigável
    'Número máximo de investimentos cadastrados', // Descrição
    'financial',                  // Categoria
    10,                           // Valor padrão
    { minValue: 1, maxValue: -1, unit: 'investimentos' } // Opções
  ),
]);
```

**Pronto!** Suas features agora aparecem automaticamente no Admin > Planos.

---

## 2. Usar Features em Componentes

### 2.1 Mostrar/Ocultar Botões

```tsx
import { FeatureGuard } from '@/components/guards/FeatureGuard';

function AccountsPage() {
  return (
    <div>
      <h1>Contas</h1>
      
      {/* Botão só aparece se tiver a feature */}
      <FeatureGuard feature="accounts_create">
        <Button onClick={handleCreate}>
          <Plus /> Nova Conta
        </Button>
      </FeatureGuard>
      
      {/* Ou com mensagem de upgrade */}
      <FeatureGuard feature="accounts_export" showUpgradeMessage>
        <Button>
          <Download /> Exportar
        </Button>
      </FeatureGuard>
    </div>
  );
}
```

### 2.2 Verificação Condicional

```tsx
import { useFeature } from '@/hooks/use-feature';

function TransactionForm() {
  const { hasFeature } = useFeature('ml_classification');
  
  return (
    <form>
      {hasFeature && (
        <div>
          <Switch>Usar IA para categorizar</Switch>
        </div>
      )}
    </form>
  );
}
```

### 2.3 Verificar Múltiplas Features

```tsx
import { useFeatures } from '@/hooks/use-feature';

function AccountsToolbar() {
  const features = useFeatures([
    'accounts_create',
    'accounts_edit',
    'accounts_delete'
  ]);
  
  return (
    <div className="flex gap-2">
      {features.accounts_create.hasFeature && (
        <Button>Criar</Button>
      )}
      {features.accounts_edit.hasFeature && (
        <Button>Editar</Button>
      )}
      {features.accounts_delete.hasFeature && (
        <Button variant="destructive">Excluir</Button>
      )}
    </div>
  );
}
```

---

## 3. Proteger Rotas

### 3.1 Proteger Página Inteira

```tsx
import { FeaturePageGuard } from '@/components/guards/FeatureGuard';

function AdvancedReportsPage() {
  return (
    <FeaturePageGuard feature="reports_advanced">
      {/* Conteúdo da página - só renderiza se tiver feature */}
      <div>
        <h1>Relatórios Avançados</h1>
        <AdvancedCharts />
        <ExportOptions />
      </div>
    </FeaturePageGuard>
  );
}

export default AdvancedReportsPage;
```

Se o usuário não tiver a feature, verá uma tela bonita de upgrade.

### 3.2 Proteger Rotas no Router

```tsx
// App.tsx ou routes.tsx

import { FeaturePageGuard } from '@/components/guards/FeatureGuard';

<Route 
  path="/sistema/analytics" 
  element={
    <FeaturePageGuard feature="analytics_trends">
      <AnalyticsPage />
    </FeaturePageGuard>
  } 
/>
```

---

## 4. Verificar Limites

### 4.1 Antes de Criar Recurso

```tsx
import { useLimit } from '@/hooks/use-feature';
import { useAccounts } from '@/hooks/use-accounts';

function CreateAccountButton() {
  const { accounts } = useAccounts();
  const { canUse, remaining, limit } = useLimit('max_accounts', accounts.length);
  
  if (!canUse) {
    return (
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertTitle>Limite atingido</AlertTitle>
        <AlertDescription>
          Você atingiu o limite de {limit} contas.
          <Button size="sm" onClick={() => navigate('/pricing')}>
            Fazer Upgrade
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div>
      <Button onClick={handleCreate}>
        Nova Conta ({remaining} restantes)
      </Button>
    </div>
  );
}
```

### 4.2 Com LimitGuard

```tsx
import { LimitGuard } from '@/components/guards/FeatureGuard';
import { useAccounts } from '@/hooks/use-accounts';

function AccountsPage() {
  const { accounts } = useAccounts();
  
  return (
    <div>
      <h1>Contas</h1>
      
      {/* Botão desaparece quando atingir o limite */}
      <LimitGuard limit="max_accounts" currentValue={accounts.length}>
        <Button onClick={handleCreate}>
          <Plus /> Nova Conta
        </Button>
      </LimitGuard>
      
      <AccountsList accounts={accounts} />
    </div>
  );
}
```

---

## 5. Adicionar Features ao Plano Admin

Quando você adicionar features em `orbi-features.ts`, elas **aparecem automaticamente** no Admin!

### Passo a Passo:

1. **Adicione a feature** em `src/lib/features/orbi-features.ts`
2. **Acesse** `/admin/plans`
3. **Edite um plano** ou crie um novo
4. **Vá na aba Features** - sua feature estará lá!
5. **Ative/desative** as features para cada plano
6. **Salve** o plano

---

## 📦 Categorias Disponíveis

```typescript
type FeatureCategory = 
  | 'core'           // Funcionalidades centrais (sempre incluir)
  | 'financial'      // Contas, transações, cartões
  | 'analytics'      // Relatórios, análises, gráficos
  | 'automation'     // ML, IA, automações
  | 'integration'    // APIs, webhooks, importação
  | 'collaboration'  // Equipe, compartilhamento
  | 'customization'  // Personalização, branding
  | 'support';       // Suporte e atendimento
```

---

## 🎯 Exemplo Completo: Nova Funcionalidade de Metas

### 1. Registrar Features

```typescript
// src/lib/features/orbi-features.ts

featureRegistry.registerFeatures([
  defineFeature(
    'goals_view',
    'Visualizar Metas',
    'Visualizar metas financeiras',
    'financial',
    { route: '/sistema/goals' }
  ),
  defineFeature(
    'goals_create',
    'Criar Metas',
    'Criar novas metas financeiras',
    'financial',
    { dependencies: ['goals_view'] }
  ),
  defineFeature(
    'goals_tracking',
    'Acompanhamento de Metas',
    'Acompanhar progresso das metas com gráficos',
    'analytics',
    { dependencies: ['goals_view'] }
  ),
]);

featureRegistry.registerLimits([
  defineLimit(
    'max_goals',
    'Máximo de Metas',
    'Número máximo de metas ativas simultaneamente',
    'financial',
    5,
    { minValue: 1, maxValue: -1, unit: 'metas' }
  ),
]);
```

### 2. Criar Página com Proteção

```tsx
// src/pages/Goals.tsx

import { FeaturePageGuard, LimitGuard } from '@/components/guards/FeatureGuard';
import { useGoals } from '@/hooks/use-goals';
import { useFeature } from '@/hooks/use-feature';

function GoalsPage() {
  return (
    <FeaturePageGuard feature="goals_view">
      <GoalsContent />
    </FeaturePageGuard>
  );
}

function GoalsContent() {
  const { goals } = useGoals();
  const { hasFeature } = useFeature('goals_tracking');
  
  return (
    <div>
      <h1>Metas Financeiras</h1>
      
      {/* Botão de criar com limite */}
      <LimitGuard limit="max_goals" currentValue={goals.length}>
        <Button onClick={handleCreate}>
          <Plus /> Nova Meta
        </Button>
      </LimitGuard>
      
      {/* Lista de metas */}
      <GoalsList goals={goals} />
      
      {/* Gráficos só para quem tem a feature */}
      {hasFeature && (
        <div className="mt-8">
          <h2>Acompanhamento</h2>
          <GoalsChart goals={goals} />
        </div>
      )}
    </div>
  );
}

export default GoalsPage;
```

### 3. Configurar no Admin

1. Acesse `/admin/plans`
2. Edite o plano "Básico" e ative apenas `goals_view`
3. Edite o plano "Pro" e ative `goals_view`, `goals_create` e `goals_tracking`
4. Configure `max_goals`: Básico = 3, Pro = -1 (ilimitado)

**Pronto!** Sistema de metas funcionando com permissões! 🎉

---

## 💡 Dicas

- **Features Core**: Use `isCore: true` para features essenciais que não podem ser desativadas
- **Dependencies**: Use `dependencies` para indicar que uma feature depende de outra
- **Categorias**: Agrupe features relacionadas na mesma categoria
- **Descrições**: Escreva descrições claras - elas aparecem no admin e nas mensagens de upgrade
- **Limites**: Use `-1` para ilimitado
- **Loading**: Os hooks retornam `isLoading` - use para mostrar skeletons

---

## 🔄 Fluxo de Adição de Nova Feature

```
1. Criar nova tela/entidade
   ↓
2. Registrar features em orbi-features.ts
   ↓
3. Usar FeatureGuard/useFeature nos componentes
   ↓
4. Configurar no Admin > Planos
   ↓
5. Testar com diferentes planos
   ↓
6. Deploy! ✅
```

---

## 📚 Referência Rápida

| Hook/Component | Uso |
|----------------|-----|
| `useFeature(key)` | Verificar uma feature |
| `useFeatures([keys])` | Verificar múltiplas features |
| `useLimit(key, value)` | Verificar limite |
| `<FeatureGuard>` | Mostrar/ocultar componentes |
| `<LimitGuard>` | Controlar por limite |
| `<FeaturePageGuard>` | Proteger páginas inteiras |

---

**Dúvidas?** Consulte o código em:
- `src/lib/features/feature-registry.ts` - Sistema base
- `src/lib/features/orbi-features.ts` - Definições das features
- `src/hooks/use-feature.ts` - Hooks de verificação
- `src/components/guards/FeatureGuard.tsx` - Guards de proteção

