#!/usr/bin/env bash
#
# Deploy da frente de agendamento (A1–A11) + V7. Roda NA VPS.
#
# Faz, em ordem e abortando no primeiro erro: backup verificado → deploy →
# health check → conferência do que as migrations produziram.
#
# NÃO contém segredos (R9): tudo vem de variável de ambiente. Nada é impresso
# que possa vazar chave.
#
# Uso:
#   export DOKPLOY_URL="https://<seu-dokploy>"
#   export DOKPLOY_API_KEY="..."
#   ./deploy-agenda.sh
#
# Se preferir disparar o deploy pelo painel do Dokploy em vez da API:
#   DEPLOY_MANUAL=1 ./deploy-agenda.sh
# (o script para, espera você clicar em Deploy e segue sozinho para o health.)
#
set -euo pipefail

# ── Parâmetros (todos sobrescrevíveis por env) ──────────────────────────────
APP_ID="${DOKPLOY_APP_ID:-rQ_sgLhWZyb6ihF0nbs4a}"   # claude.md
PG_CONTAINER="${PG_CONTAINER:-miozorio-pgmiozorio-p6ecqh}"
DB_NAME="${POSTGRES_DB:-miozorio}"
DB_USER="${POSTGRES_USER:-miozorio}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/pg-miozorio}"
HEALTH_URL="${HEALTH_URL:-https://miozorio.com.br/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-300}"            # segundos
DEPLOY_MANUAL="${DEPLOY_MANUAL:-0}"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/pre-agenda-${STAMP}.sql.gz"

log()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

psql_q() { docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1"; }

# ── 0. Pré-voo ──────────────────────────────────────────────────────────────
log "Pré-voo"
command -v docker >/dev/null || fail "docker não encontrado — este script roda NA VPS."
docker inspect "$PG_CONTAINER" >/dev/null 2>&1 \
  || fail "container '$PG_CONTAINER' não existe. Ajuste PG_CONTAINER."
ok "container do banco encontrado"

if [ "$DEPLOY_MANUAL" != "1" ]; then
  [ -n "${DOKPLOY_URL:-}" ]     || fail "DOKPLOY_URL não definida (ou use DEPLOY_MANUAL=1)."
  [ -n "${DOKPLOY_API_KEY:-}" ] || fail "DOKPLOY_API_KEY não definida (ou use DEPLOY_MANUAL=1)."
  ok "credenciais do Dokploy presentes"
fi

psql_q "select 1;" >/dev/null || fail "não consegui consultar o banco."
ok "banco respondendo"

BOOKINGS_ANTES="$(psql_q "select count(*) from bookings;")"
ok "bookings hoje: ${BOOKINGS_ANTES}"

# ── 1. Backup (o único passo que não dá para refazer) ───────────────────────
log "Backup do banco"
mkdir -p "$BACKUP_DIR"
docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

# Um pg_dump que falha no meio deixa um .gz pequeno e válido. Conferir o
# tamanho E o conteúdo evita descobrir que o backup era inútil só na hora H.
BYTES="$(stat -c%s "$BACKUP_FILE")"
[ "$BYTES" -gt 10000 ] || fail "backup suspeito (${BYTES} bytes). NÃO siga."
gzip -t "$BACKUP_FILE"  || fail "backup corrompido. NÃO siga."
zcat "$BACKUP_FILE" | grep -q "CREATE TABLE" \
  || fail "backup sem CREATE TABLE — conteúdo inesperado. NÃO siga."
ok "backup íntegro: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# ── 2. Deploy ───────────────────────────────────────────────────────────────
log "Deploy"
if [ "$DEPLOY_MANUAL" = "1" ]; then
  printf '  Abra o Dokploy e clique em Deploy na aplicação portal-miozorio.\n'
  printf '  Quando tiver clicado, pressione ENTER para eu acompanhar o health…'
  read -r _
else
  # A API do Dokploy é tRPC e o zod dela exige TODOS os campos do schema:
  # campo ausente devolve 400 (lição registrada no claude.md).
  HTTP="$(curl -sS -o /tmp/deploy-resp.json -w '%{http_code}' \
    -X POST "${DOKPLOY_URL%/}/api/application.deploy" \
    -H "x-api-key: ${DOKPLOY_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d "{\"applicationId\":\"${APP_ID}\"}" || true)"
  if [ "$HTTP" != "200" ] && [ "$HTTP" != "201" ]; then
    printf '  resposta: %s\n' "$(head -c 400 /tmp/deploy-resp.json 2>/dev/null || true)"
    fail "Dokploy devolveu HTTP ${HTTP}. Rode de novo com DEPLOY_MANUAL=1 e dispare pelo painel."
  fi
  ok "deploy disparado (HTTP ${HTTP})"
fi

# ── 3. Health ───────────────────────────────────────────────────────────────
log "Esperando o app voltar (até ${HEALTH_TIMEOUT}s)"
DEADLINE=$(( $(date +%s) + HEALTH_TIMEOUT ))
while :; do
  CODE="$(curl -sS -m 10 -o /tmp/health.json -w '%{http_code}' "$HEALTH_URL" || echo 000)"
  if [ "$CODE" = "200" ]; then
    ok "health 200: $(head -c 200 /tmp/health.json)"
    break
  fi
  [ "$(date +%s)" -lt "$DEADLINE" ] \
    || fail "health não voltou 200 em ${HEALTH_TIMEOUT}s (último: ${CODE}). Veja os logs no Dokploy; o backup está em ${BACKUP_FILE}."
  printf '.'; sleep 5
done

# ── 4. Conferência do que as migrations produziram ──────────────────────────
log "Conferindo o banco"

MIGRACOES="$(psql_q "select count(*) from _prisma_migrations where migration_name like '20260913%' and finished_at is not null;")"
[ "$MIGRACOES" = "6" ] || fail "esperava 6 migrations de 13/09 aplicadas, encontrei ${MIGRACOES}."
ok "as 6 migrations aplicadas"

# A R2 é a regra mais crítica: confirmar que a trava seguiu intacta.
psql_q "select 1 from pg_constraint where conname='no_overlap';" | grep -q 1 \
  || fail "constraint no_overlap SUMIU. Restaure o backup."
ok "trava anti-double-booking (R2) intacta"

psql_q "select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='CancelledBy';" \
  | grep -q '^3$' || fail "enum CancelledBy não tem os 3 valores."
ok "enum CancelledBy com SYSTEM/CLIENT/ADMIN"

psql_q "select to_regclass('service_variants') is not null;" | grep -q t \
  || fail "tabela service_variants não existe."
ok "service_variants criada"

PRAZOS="$(psql_q "select count(*) from business_settings where key in ('deposit_percent','deposit_hold_hours','deposit_cutoff_hours');")"
[ "$PRAZOS" = "3" ] || fail "settings de prazo do sinal incompletos (${PRAZOS}/3)."
ok "prazos do sinal semeados"

COM_SINAL="$(psql_q "select count(*) from services where requires_deposit;")"
ok "serviços exigindo sinal: ${COM_SINAL} (esperado 0 — a regra de reincidência não depende disto)"

BOOKINGS_DEPOIS="$(psql_q "select count(*) from bookings;")"
[ "$BOOKINGS_DEPOIS" = "$BOOKINGS_ANTES" ] \
  || fail "contagem de bookings mudou (${BOOKINGS_ANTES} → ${BOOKINGS_DEPOIS}). Investigue antes de seguir."
ok "nenhum agendamento perdido (${BOOKINGS_DEPOIS})"

# ── 5. Fim ──────────────────────────────────────────────────────────────────
log "Deploy concluído"
cat <<FIM
  Backup: ${BACKUP_FILE}

  Próximos passos, MANUAIS e nesta ordem:

  1) Abrir /admin e conferir um dia com atendimentos:
     - reserva vencida sozinha agora diz "Expirado (sistema)", não "Cancelado (Mi)"
     - o ⚠ de alergia não aparece em quem respondeu "Não"

  2) Agendar um horário pelo site e conferir se o WhatsApp da Mi recebe
     "✨ Novo agendamento". Se não chegar, /admin/mensagens mostra o status.

  3) Limpar os serviços duplicados (os três "Buço") — DRY-RUN primeiro:
       npx tsx scripts/dedup-servicos.ts
       npx tsx scripts/dedup-servicos.ts --aplicar

  Rollback: o Dokploy mantém a versão anterior (as migrations são aditivas e
  não atrapalham). Se precisar do banco:
       zcat ${BACKUP_FILE} | docker exec -i ${PG_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}
FIM
