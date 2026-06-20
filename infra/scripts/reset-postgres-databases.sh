#!/usr/bin/env sh
set -eu

target="${1:-}"
compose_file="infra/docker-compose.yml"
databases="sparkflow_identity sparkflow_challenge sparkflow_submission sparkflow_evaluation sparkflow_notification"

run_psql() {
  docker compose -f "$compose_file" exec -T postgres psql -U sparkflow -d postgres -c "$1"
}

reset_database() {
  database_name="$1"

  run_psql "DROP DATABASE IF EXISTS $database_name WITH (FORCE)"
  run_psql "CREATE DATABASE $database_name"
}

case "$target" in
  evaluation)
    reset_database "sparkflow_evaluation"
    ;;
  all)
    for database_name in $databases; do
      reset_database "$database_name"
    done
    ;;
  *)
    echo "Usage: sh infra/scripts/reset-postgres-databases.sh evaluation|all" >&2
    exit 1
    ;;
esac
