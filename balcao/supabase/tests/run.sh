#!/usr/bin/env bash
# Cria um banco temporário, aplica as migrações e o seed e roda os testes.
# Usa as variáveis padrão do psql (PGHOST, PGUSER, PGPASSWORD...).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="balcao_teste_$$"
PSQL="psql -q -v ON_ERROR_STOP=1 -d $DB"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
$PSQL -f tests/stubs.sql
for f in migrations/*.sql; do $PSQL -f "$f"; done
$PSQL -f seed.sql > /dev/null
$PSQL -f tests/database.sql 2>&1 | grep -v "^$" | sed "s/^psql:[^ ]* NOTICE:  /  /"
