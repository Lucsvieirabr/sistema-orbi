#!/usr/bin/env bash
# =============================================================================
# Sistema Orbi — HARD RESET do banco REMOTO (projeto linkado no Supabase CLI)
# -----------------------------------------------------------------------------
#   1. Wipe completo do banco remoto
#   2. Reaplica TODAS as migrations desde a primeira (supabase/migrations/*.sql)
#   3. Injeta supabase/seed.sql (3 cenários de plano: Admin / Free / Pro)
#   4. Verifica o resultado (migrations aplicadas + cadeia auth->profile->plano)
#
# ⚠  DESTRUTIVO E IRREVERSÍVEL: apaga TODOS os dados do banco remoto linkado,
#    inclusive auth.users. Não existe undo.
#
# EXECUÇÃO 100% NÃO-INTERATIVA (nenhum prompt; CI-safe):
#
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx          # token de acesso do CLI
#   export SUPABASE_DB_PASSWORD='senha-do-banco'  # senha do Postgres do projeto
#   export ORBI_CONFIRM_RESET=RESET               # trava anti-acidente
#   ./reset-remote-db.sh
#
# Flags:
#   --force / -y      equivale a ORBI_CONFIRM_RESET=RESET
#   --dry-run         mostra o plano de execução e sai
#   --no-seed         aplica migrations sem injetar o seed
#   --project-ref X   sobrepõe supabase/.temp/project-ref
# =============================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SUPABASE_DIR="$SCRIPT_DIR/supabase"
MIGRATIONS_DIR="$SUPABASE_DIR/migrations"
SEED_FILE="$SUPABASE_DIR/seed.sql"
LOG_DIR="$SCRIPT_DIR/.orbi-logs"
LOG_FILE="$LOG_DIR/reset-remote-$(date +%Y%m%d-%H%M%S).log"

DRY_RUN=0
RUN_SEED=1
PROJECT_REF=""

# ------------------------------------------------------------------ logging --
mkdir -p "$LOG_DIR"
log()  { printf '\033[0;36m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG_FILE"; }
ok()   { printf '\033[0;32m[%s]  OK  %s\033[0m\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG_FILE"; }
warn() { printf '\033[0;33m[%s] AVISO %s\033[0m\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG_FILE"; }
die()  { printf '\033[0;31m[%s] ERRO  %s\033[0m\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2; exit 1; }
trap 'die "falha na linha $LINENO (comando: $BASH_COMMAND)"' ERR

# ------------------------------------------------------------------- flags ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-y)     ORBI_CONFIRM_RESET=RESET; shift ;;
    --dry-run)      DRY_RUN=1; shift ;;
    --no-seed)      RUN_SEED=0; shift ;;
    --project-ref)  PROJECT_REF="${2:?--project-ref exige um valor}"; shift 2 ;;
    -h|--help)      sed -n '2,32p' "$0"; exit 0 ;;
    *)              die "flag desconhecida: $1" ;;
  esac
done

# =============================================================================
# 1. PREFLIGHT
# =============================================================================
log "Preflight…"

[[ -d "$MIGRATIONS_DIR" ]] || die "não achei $MIGRATIONS_DIR — rode a partir da raiz do repositório."

MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')
[[ "$MIGRATION_COUNT" -gt 0 ]] || die "nenhuma migration em $MIGRATIONS_DIR."

if [[ "$RUN_SEED" -eq 1 && ! -f "$SEED_FILE" ]]; then
  die "seed habilitado mas $SEED_FILE não existe."
fi

# --- CLI do Supabase (binário local ou npx pinado) ---------------------------
CLI_VERSION="$(cat "$SUPABASE_DIR/.temp/cli-latest" 2>/dev/null | tr -d 'v \n' || true)"
CLI_VERSION="${CLI_VERSION:-2.117.0}"
if command -v supabase >/dev/null 2>&1; then
  SUPABASE_BIN=(supabase)
elif command -v npx >/dev/null 2>&1; then
  SUPABASE_BIN=(npx --yes "supabase@${CLI_VERSION}")
else
  die "Supabase CLI não encontrado e npx indisponível. Instale: https://supabase.com/docs/guides/cli"
fi
log "CLI: ${SUPABASE_BIN[*]}"

# --- project ref -------------------------------------------------------------
if [[ -z "$PROJECT_REF" && -f "$SUPABASE_DIR/.temp/project-ref" ]]; then
  PROJECT_REF="$(tr -d ' \n' < "$SUPABASE_DIR/.temp/project-ref")"
fi
[[ -n "$PROJECT_REF" ]] || die "project ref indefinido. Use --project-ref <ref> ou linke o projeto (supabase link)."

# --- credenciais obrigatórias (sem elas o CLI abriria prompt) ----------------
[[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] || warn "SUPABASE_ACCESS_TOKEN vazio — usando sessão de 'supabase login', se houver."
[[ -n "${SUPABASE_DB_PASSWORD:-}" ]] || die "SUPABASE_DB_PASSWORD é obrigatório (evita prompt interativo)."

# --- trava anti-acidente ------------------------------------------------------
if [[ "${ORBI_CONFIRM_RESET:-}" != "RESET" ]]; then
  die "Trava de segurança ativa. Este script APAGA o banco remoto '$PROJECT_REF'.
       Para prosseguir: export ORBI_CONFIRM_RESET=RESET   (ou use --force)"
fi

# --- URL do banco para psql (verificação e fallback de seed) -----------------
urlencode() { local s="$1" o="" c; for ((i=0;i<${#s};i++)); do c="${s:i:1}"
  case "$c" in [a-zA-Z0-9.~_-]) o+="$c" ;; *) printf -v c '%%%02X' "'$c"; o+="$c" ;; esac; done; printf '%s' "$o"; }

DB_URL="${SUPABASE_DB_URL:-}"
if [[ -z "$DB_URL" ]]; then
  POOLER="$(cat "$SUPABASE_DIR/.temp/pooler-url" 2>/dev/null | tr -d ' \n' || true)"
  if [[ -n "$POOLER" ]]; then
    DB_URL="${POOLER/@/:$(urlencode "$SUPABASE_DB_PASSWORD")@}"
  else
    DB_URL="postgresql://postgres:$(urlencode "$SUPABASE_DB_PASSWORD")@db.${PROJECT_REF}.supabase.co:5432/postgres"
  fi
fi
HAS_PSQL=0; command -v psql >/dev/null 2>&1 && HAS_PSQL=1
[[ "$HAS_PSQL" -eq 1 ]] || warn "psql ausente: seed e verificação ficam a cargo do CLI."

# --- aviso: major_version do config.toml x versão real do remoto ----------
CFG_MAJOR="$(grep -E '^[[:space:]]*major_version' "$SUPABASE_DIR/config.toml" 2>/dev/null | head -1 | tr -dc '0-9' || true)"
REMOTE_MAJOR="$(cut -d. -f1 "$SUPABASE_DIR/.temp/postgres-version" 2>/dev/null | tr -dc '0-9' || true)"
if [[ -n "$CFG_MAJOR" && -n "$REMOTE_MAJOR" && "$CFG_MAJOR" != "$REMOTE_MAJOR" ]]; then
  warn "config.toml [db] major_version=$CFG_MAJOR mas o remoto roda Postgres $REMOTE_MAJOR — ajuste o config para evitar divergência com o ambiente local."
fi

ok "Preflight concluído — projeto=$PROJECT_REF, migrations=$MIGRATION_COUNT, seed=$([[ $RUN_SEED -eq 1 ]] && echo sim || echo não)"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "DRY-RUN — nada foi executado. Plano:"
  log "  1) supabase link --project-ref $PROJECT_REF"
  log "  2) supabase db reset --linked        (wipe + $MIGRATION_COUNT migrations + seed)"
  log "  3) fallback: supabase db push --include-all + psql -f supabase/seed.sql"
  log "  4) verificação: supabase migration list --linked + queries de integridade"
  exit 0
fi

# =============================================================================
# 2. HELPERS DE EXECUÇÃO NÃO-INTERATIVA
# =============================================================================
# O CLI só pergunta quando stdin é TTY; </dev/null já garante o modo automático.
# Ainda assim passamos --yes quando a subcomando aceita.
supports_yes() { "${SUPABASE_BIN[@]}" "$@" --help </dev/null 2>&1 | grep -q -- '--yes'; }

sb() { # sb <args...>
  log "\$ supabase $*"
  "${SUPABASE_BIN[@]}" "$@" </dev/null 2>&1 | tee -a "$LOG_FILE"
  return "${PIPESTATUS[0]}"
}

psql_run() { PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"; }

YES_FLAG=()
if supports_yes db reset; then YES_FLAG=(--yes); fi

# =============================================================================
# 2.5 GARANTE O SEED NO config.toml
# -----------------------------------------------------------------------------
# Sem a seção [db.seed], versões diferentes do CLI decidem sozinhas se rodam
# supabase/seed.sql. Declarar explicitamente evita "resetou mas não semeou".
# =============================================================================
if [[ "$RUN_SEED" -eq 1 ]] && ! grep -q '^\[db\.seed\]' "$SUPABASE_DIR/config.toml"; then
  log "Declarando [db.seed] em supabase/config.toml (seed determinístico)…"
  printf '\n[db.seed]\nenabled = true\nsql_paths = ["./seed.sql"]\n' >> "$SUPABASE_DIR/config.toml"
  ok "[db.seed] adicionado ao config.toml."
fi

# =============================================================================
# 3. LINK DO PROJETO (idempotente, sem prompt)
# =============================================================================
log "Linkando projeto remoto $PROJECT_REF…"
sb link --project-ref "$PROJECT_REF" || die "falha ao linkar o projeto $PROJECT_REF."
ok "Projeto linkado."

# =============================================================================
# 4. HARD RESET REMOTO — wipe + todas as migrations + seed
# =============================================================================
log "HARD RESET do banco remoto (wipe + $MIGRATION_COUNT migrations + seed)…"
RESET_OK=0
if sb db reset --linked "${YES_FLAG[@]}"; then
  RESET_OK=1
  ok "db reset --linked concluído."
else
  warn "db reset --linked falhou nesta versão do CLI — caindo para wipe manual + db push."
fi

# ---- Fallback: wipe manual via psql + push forçado de todas as migrations ----
if [[ "$RESET_OK" -eq 0 ]]; then
  [[ "$HAS_PSQL" -eq 1 ]] || die "fallback exige psql instalado (client do PostgreSQL)."

  log "Wipe manual dos schemas de aplicação…"
  psql_run <<'WIPE'
BEGIN;
-- Derruba o schema de aplicação inteiro e o histórico de migrations.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres;
ALTER SCHEMA public OWNER TO postgres;

DROP SCHEMA IF EXISTS supabase_migrations CASCADE;
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);

-- Zera o GoTrue (usuários, identidades e sessões).
TRUNCATE auth.users CASCADE;
COMMIT;
WIPE
  ok "Wipe manual concluído."

  PUSH_YES=(); supports_yes db push && PUSH_YES=(--yes)
  log "Reaplicando TODAS as migrations desde a primeira (db push --include-all)…"
  sb db push --include-all "${PUSH_YES[@]}" || die "db push --include-all falhou."
  ok "Migrations reaplicadas."
fi

# =============================================================================
# 5. SEED — injeção explícita e idempotente
# =============================================================================
if [[ "$RUN_SEED" -eq 1 ]]; then
  if [[ "$HAS_PSQL" -eq 1 ]]; then
    log "Injetando supabase/seed.sql…"
    psql_run -f "$SEED_FILE" | tee -a "$LOG_FILE"
    ok "Seed aplicado."
  elif [[ "$RESET_OK" -eq 1 ]]; then
    warn "psql ausente — seed foi aplicado pelo próprio 'db reset' (config [db.seed])."
  else
    die "seed pendente: instale o psql ou rode 'supabase db reset --linked' com o seed habilitado."
  fi
fi

# =============================================================================
# 6. VERIFICAÇÃO
# =============================================================================
log "Verificando estado do banco remoto…"
sb migration list --linked || warn "não foi possível listar as migrations."

if [[ "$HAS_PSQL" -eq 1 ]]; then
  psql_run -P pager=off <<'VERIFY' | tee -a "$LOG_FILE"
\echo '--- migrations aplicadas ---'
SELECT COUNT(*) AS migrations_aplicadas FROM supabase_migrations.schema_migrations;

\echo '--- planos ---'
SELECT slug, name, price_monthly, limits->>'max_contas' AS max_contas
  FROM public.subscription_plans ORDER BY display_order;

\echo '--- cadeia auth -> profile -> subscription -> plan ---'
SELECT u.email,
       (p.user_id IS NOT NULL)                       AS tem_perfil,
       COALESCE(pl.slug, '-')                        AS plano,
       COALESCE(s.status, '-')                       AS status,
       (SELECT COUNT(*) FROM public.accounts     a WHERE a.user_id = u.id) AS contas,
       (SELECT COUNT(*) FROM public.credit_cards c WHERE c.user_id = u.id) AS cartoes,
       (SELECT COUNT(*) FROM public.people       h WHERE h.user_id = u.id) AS pessoas,
       (SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = u.id) AS txns,
       EXISTS (SELECT 1 FROM public.admin_users ad WHERE ad.user_id = u.id AND ad.is_active) AS admin
  FROM auth.users u
  LEFT JOIN public.user_profiles      p  ON p.user_id = u.id
  LEFT JOIN public.user_subscriptions s  ON s.user_id = u.id AND s.status IN ('trial','active')
  LEFT JOIN public.subscription_plans pl ON pl.id = s.plan_id
 ORDER BY u.email;

\echo '--- órfãos (tem que dar 0 em tudo) ---'
SELECT
  (SELECT COUNT(*) FROM public.transactions t LEFT JOIN auth.users u ON u.id = t.user_id WHERE u.id IS NULL) AS txn_sem_user,
  (SELECT COUNT(*) FROM public.user_subscriptions s LEFT JOIN public.subscription_plans p ON p.id = s.plan_id WHERE p.id IS NULL) AS assinatura_sem_plano,
  (SELECT COUNT(*) FROM public.transactions t WHERE t.series_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.series s WHERE s.id = t.series_id)) AS txn_serie_quebrada,
  (SELECT COUNT(*) FROM public.transactions t WHERE t.linked_txn_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.id = t.linked_txn_id)) AS rateio_quebrado;
VERIFY
fi

ok "HARD RESET concluído. Log: $LOG_FILE"
log "Usuários de teste — senha: Orbi@2026!seed"
log "  admin@orbi.test  → super_admin + plano Pro"
log "  free@orbi.test   → plano Free (basic), no teto das cotas"
log "  pro@orbi.test    → plano Pro ativo (ilimitado)"
