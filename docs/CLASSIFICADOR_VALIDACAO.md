# Classificador: implementação e validação

## Situação em 22/09/2026

A função `classify-transactions` foi publicada no projeto Supabase vinculado
(`cpmkmkvdpactvkpwwrvf`). A interface foi compilada localmente, não publicada.
A migração `20260921164008_classifier_verified_learning.sql` ainda NÃO foi aplicada
remotamente: `supabase db push --dry-run` falhou por autenticação do PostgreSQL
(`28P01`). Nenhum histórico financeiro de produção foi alterado nesta validação.

## Mudanças

- Normalização preserva o estabelecimento após intermediadores, identifica
  iFood, Uber Eats, 99 Food e transporte separadamente e remove parcelas/datas.
- Regras de estorno precedem salário e rendimentos; aluguel de veículo, posto de
  saúde, contas de consumo e compras sem juros recebem tratamento específico.
- PIX com nomes de pessoas, intermediadores isolados e conflitos fuzzy exigem
  revisão. Empates não dependem da ordem do catálogo.
- O vocabulário complementar é versionado e respeita as decisões existentes
  no dicionário, inclusive nomes equivalentes e aliases.
- Categorias são resolvidas por ID, proprietário e direção. Regras novas
  sobrevivem a renomeações de categoria; IDs excluídos não são reaproveitados.
- A importação preserva linhas boas quando um bloco falha, identifica duplicatas
  por direção e destino, mantém falhas abertas para correção e aprende apenas
  mudanças explícitas de categoria em linhas efetivamente salvas.
- A nova RPC lê a transação pelo UUID persistido, verifica usuário, categoria,
  direção e sessão MFA. Receita e despesa não sobrescrevem a mesma regra.
- “Minha IA” atualiza metadados da categoria, limpa subcategoria antiga, conserva
  o formulário em caso de erro e calcula estatísticas sobre as mesmas regras ativas.

## Verificação

`npm test`: 94 testes aprovados. Incluem normalização, decisões, aprendizado,
isolamento, falhas parciais, duplicatas e ordenação. O teste histórico executa os
INSERTs SQL reais do catálogo e as duas migrações de enriquecimento em PostgreSQL
embutido (PGlite), respeitando `ON CONFLICT`. Não é um replay de todo o banco.

O teste da nova RPC executa a migração real com tabelas mínimas, RLS e dois usuários.
Autenticação/MFA são simuladas: isso não substitui um teste integrado no Supabase.
Não foram realizados testes de navegador autenticado ou importação em produção.

`npm run build`: aprovado. Permanecem avisos de bundle grande e Browserslist antigo.
A checagem TypeScript isolada do motor passou. A checagem global do projeto ainda
falha em componentes/hooks preexistentes (Dashboard, dívidas, séries e outros).
ESLint dos arquivos ativos alterados: aprovado.

## Publicação pendente

1. Restaurar a autenticação do banco Supabase usando o fluxo seguro da CLI ou o
   Dashboard. Não colocar senhas no repositório, chat ou comandos versionados.
2. Conferir o histórico remoto e aplicar a migração
   `20260921164008_classifier_verified_learning.sql`. Não aplicar outras migrações
   pendentes sem revisar seu escopo.
3. Testar a RPC com uma sessão autenticada e uma transação própria de teste.
4. Publicar a interface pelo fluxo habitual do projeto, somente após a migração.
5. Importar um extrato de teste, corrigir uma categoria, conferir a regra em
   “Minha IA” e reimportar outro extrato equivalente para validar a sugestão.

Se a interface for publicada antes da migração, os lançamentos ainda podem ser
salvos, mas o aprendizado falhará com um aviso explícito. Não há fallback silencioso
para a RPC antiga, que não distingue receitas e despesas.

## O que significa “treinamento” aqui

Este motor usa regras, dicionário e memória das correções do usuário; não foi
treinada uma rede neural. O vocabulário adicionado não é um dataset rotulado de
clientes, e os testes de regressão não demonstram uma porcentagem de acurácia real.
As pontuações são heurísticas, não probabilidades calibradas.

Para medir qualidade real, reunir exemplos anonimizados e revisados por categoria,
separar avaliação por estabelecimento (evitando repetir a mesma descrição entre
treino e teste) e medir precisão por categoria, cobertura automática e taxa de
revisão. Nunca promover automaticamente previsões não confirmadas a exemplos de
aprendizado: isso reforça os próprios erros.

O trabalho cobre a classificação após extração/importação. Não acrescenta um
exportador PDF; o fluxo existente identificado é de extração/importação de PDF.
