#!/usr/bin/env bash
set -euo pipefail

api_url="${SPARKFLOW_API_URL:-http://localhost:3000}"
keycloak_token_url="${KEYCLOAK_TOKEN_URL:-http://localhost:8080/realms/sparkflow/protocol/openid-connect/token}"
keycloak_client_id="${KEYCLOAK_CLIENT_ID:-sparkflow-web}"
company_admin_username="${COMPANY_ADMIN_USERNAME:-company-admin}"
startup_member_username="${STARTUP_MEMBER_USERNAME:-startup-member}"
user_password="${USER_PASSWORD:-sparkflow}"
body_file="${SMOKE_BODY_FILE:-/tmp/sparkflow-smoke-response.json}"
notification_retry_count="${SMOKE_NOTIFICATION_RETRY_COUNT:-10}"
notification_retry_delay="${SMOKE_NOTIFICATION_RETRY_DELAY:-1}"
challenge_status_retry_count="${SMOKE_CHALLENGE_STATUS_RETRY_COUNT:-10}"
challenge_status_retry_delay="${SMOKE_CHALLENGE_STATUS_RETRY_DELAY:-1}"

require_command() {
  local command_name="$1"

  if command -v "$command_name" >/dev/null 2>&1; then
    return
  fi

  echo "Missing required command: $command_name" >&2
  exit 1
}

assert_status() {
  local actual_status="$1"
  local expected_status="$2"
  local label="$3"

  if [[ "$actual_status" == "$expected_status" ]]; then
    printf 'PASS %s (%s)\n' "$label" "$actual_status"
    return
  fi

  printf 'FAIL %s expected=%s actual=%s\n' "$label" "$expected_status" "$actual_status" >&2
  jq . "$body_file" 2>/dev/null || cat "$body_file" >&2
  exit 1
}

assert_health() {
  local health_url="$1"

  curl -fsS -o /dev/null "$health_url"
  printf 'PASS health %s\n' "$health_url"
}

get_token() {
  local username="$1"

  curl -fsS "$keycloak_token_url" \
    -H "content-type: application/x-www-form-urlencoded" \
    --data-urlencode "client_id=$keycloak_client_id" \
    --data-urlencode "grant_type=password" \
    --data-urlencode "username=$username" \
    --data-urlencode "password=$user_password" |
    jq -r ".access_token"
}

request() {
  local method="$1"
  local url="$2"
  local token="$3"
  local data="${4:-}"

  if [[ -n "$data" ]]; then
    curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
      -H "authorization: Bearer $token" \
      -H "content-type: application/json" \
      --data "$data"
    return
  fi

  curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
    -H "authorization: Bearer $token"
}

wait_for_selected_notification() {
  local startup_token="$1"
  local submission_id="$2"
  local attempt_number=1

  while [[ "$attempt_number" -le "$notification_retry_count" ]]; do
    local http_status
    http_status="$(request GET "$api_url/notifications" "$startup_token")"
    assert_status "$http_status" 200 "list startup notifications"

    local selected_notifications
    selected_notifications="$(
      jq --arg submission_id "$submission_id" \
        '[.[] | select((.message | contains($submission_id)) and (.message | test("selected"; "i")))] | length' \
        "$body_file"
    )"

    if [[ "$selected_notifications" -ge 1 ]]; then
      printf 'PASS selected notification count=%s\n' "$selected_notifications"
      return
    fi

    sleep "$notification_retry_delay"
    attempt_number="$((attempt_number + 1))"
  done

  printf 'FAIL expected selected notification for submission=%s\n' "$submission_id" >&2
  jq . "$body_file" 2>/dev/null || cat "$body_file" >&2
  exit 1
}

wait_for_selection_completed_challenge() {
  local company_token="$1"
  local challenge_id="$2"
  local attempt_number=1

  while [[ "$attempt_number" -le "$challenge_status_retry_count" ]]; do
    local http_status
    http_status="$(request GET "$api_url/challenges" "$company_token")"
    assert_status "$http_status" 200 "list company challenges after final selection"

    local challenge_status
    challenge_status="$(
      jq -r --arg challenge_id "$challenge_id" \
        '.[] | select(.id == $challenge_id) | .status' \
        "$body_file"
    )"

    if [[ "$challenge_status" == "selection-completed" ]]; then
      printf 'PASS challenge status=%s\n' "$challenge_status"
      return
    fi

    sleep "$challenge_status_retry_delay"
    attempt_number="$((attempt_number + 1))"
  done

  printf 'FAIL expected challenge=%s status=selection-completed\n' "$challenge_id" >&2
  jq . "$body_file" 2>/dev/null || cat "$body_file" >&2
  exit 1
}

wait_for_startup_opportunity() {
  local startup_token="$1"
  local challenge_id="$2"
  local submission_id="$3"
  local attempt_number=1

  while [[ "$attempt_number" -le "$challenge_status_retry_count" ]]; do
    local http_status
    http_status="$(request GET "$api_url/me/opportunities" "$startup_token")"
    assert_status "$http_status" 200 "list startup opportunities after final selection"

    local opportunity_count
    opportunity_count="$(
      jq --arg challenge_id "$challenge_id" --arg submission_id "$submission_id" \
        '[.[] | select(.challenge.id == $challenge_id and .submission.id == $submission_id)] | length' \
        "$body_file"
    )"

    if [[ "$opportunity_count" -ge 1 ]]; then
      printf 'PASS startup opportunity count=%s\n' "$opportunity_count"
      return
    fi

    sleep "$challenge_status_retry_delay"
    attempt_number="$((attempt_number + 1))"
  done

  printf 'FAIL expected startup opportunity for challenge=%s submission=%s\n' "$challenge_id" "$submission_id" >&2
  jq . "$body_file" 2>/dev/null || cat "$body_file" >&2
  exit 1
}

require_command curl
require_command jq

assert_health "$api_url/health"

company_token="$(get_token "$company_admin_username")"
startup_token="$(get_token "$startup_member_username")"
run_id="$(date +%s)"

challenge_payload="$(
  jq -n --arg run_id "$run_id" '{
    title: "Smoke challenge \($run_id)",
    summary: "Smoke test challenge",
    description: "Validate company proposal workflow through the gateway.",
    requirements: "Use the public API and Keycloak auth.",
    budget: "10000 EUR",
    deadline: "2026-12-31"
  }'
)"

http_status="$(request POST "$api_url/challenges" "$company_token" "$challenge_payload")"
assert_status "$http_status" 201 "create challenge"
challenge_id="$(jq -r ".id" "$body_file")"

http_status="$(request POST "$api_url/challenges/$challenge_id/publish" "$company_token")"
assert_status "$http_status" 200 "publish challenge"

proposal_one_payload='{"summary":"First smoke proposal","approach":"Pilot with a focused discovery sprint.","budget":"5000 EUR","timeline":"4 weeks"}'
proposal_two_payload='{"summary":"Second smoke proposal","approach":"Pilot with implementation support.","budget":"7000 EUR","timeline":"6 weeks"}'

http_status="$(request POST "$api_url/challenges/$challenge_id/submissions" "$startup_token" "$proposal_one_payload")"
assert_status "$http_status" 201 "submit proposal one"
proposal_one_id="$(jq -r ".id" "$body_file")"

http_status="$(request POST "$api_url/challenges/$challenge_id/submissions" "$startup_token" "$proposal_two_payload")"
assert_status "$http_status" 201 "submit proposal two"
proposal_two_id="$(jq -r ".id" "$body_file")"

http_status="$(request GET "$api_url/challenges/$challenge_id/submissions" "$company_token")"
assert_status "$http_status" 200 "list proposals"
pending_count="$(jq '[.[] | select(.status == "submitted")] | length' "$body_file")"

if [[ "$pending_count" -lt 2 ]]; then
  printf 'FAIL expected at least two submitted proposals, got %s\n' "$pending_count" >&2
  jq . "$body_file"
  exit 1
fi

printf 'PASS pending proposals count=%s\n' "$pending_count"

http_status="$(request POST "$api_url/challenges/$challenge_id/submissions/$proposal_one_id/accept" "$company_token")"
assert_status "$http_status" 200 "accept proposal one"

http_status="$(request POST "$api_url/challenges/$challenge_id/submissions/$proposal_two_id/accept" "$company_token")"
assert_status "$http_status" 200 "accept proposal two"

http_status="$(request POST "$api_url/challenges/$challenge_id/submissions/$proposal_one_id/select" "$company_token")"
assert_status "$http_status" 200 "select final proposal"

wait_for_selection_completed_challenge "$company_token" "$challenge_id"

http_status="$(request POST "$api_url/challenges/$challenge_id/submissions/$proposal_two_id/select" "$company_token")"
assert_status "$http_status" 403 "reject post-selection decision"
decision_error="$(jq -r ".error" "$body_file")"

if [[ "$decision_error" != "forbidden" ]]; then
  printf 'FAIL expected forbidden, got %s\n' "$decision_error" >&2
  jq . "$body_file"
  exit 1
fi

printf 'PASS post-selection decision error=%s\n' "$decision_error"

http_status="$(request GET "$api_url/challenges/$challenge_id/submissions" "$company_token")"
assert_status "$http_status" 200 "list proposals after final selection"
selected_count="$(jq '[.[] | select(.status == "selected")] | length' "$body_file")"
accepted_count="$(jq '[.[] | select(.status == "accepted")] | length' "$body_file")"
not_selected_count="$(jq '[.[] | select(.status == "not-selected")] | length' "$body_file")"

if [[ "$selected_count" != "1" || "$accepted_count" != "0" || "$not_selected_count" != "1" ]]; then
  printf 'FAIL expected selected=1 accepted=0 not-selected=1, got selected=%s accepted=%s not-selected=%s\n' "$selected_count" "$accepted_count" "$not_selected_count" >&2
  jq . "$body_file"
  exit 1
fi

printf 'PASS statuses selected=%s accepted=%s not-selected=%s\n' "$selected_count" "$accepted_count" "$not_selected_count"

http_status="$(request GET "$api_url/challenges/$challenge_id/submissions/$proposal_one_id/decision-audits" "$company_token")"
assert_status "$http_status" 200 "list selected proposal decision audits"
selected_audit_count="$(
  jq '[.[] | select(.previousStatus == "accepted" and .newStatus == "selected")] | length' "$body_file"
)"

if [[ "$selected_audit_count" != "1" ]]; then
  printf 'FAIL expected selected audit count=1, got %s\n' "$selected_audit_count" >&2
  jq . "$body_file"
  exit 1
fi

printf 'PASS selected proposal audit count=%s\n' "$selected_audit_count"

http_status="$(request GET "$api_url/challenges/$challenge_id/submissions/$proposal_two_id/decision-audits" "$company_token")"
assert_status "$http_status" 200 "list not-selected proposal decision audits"
not_selected_audit_count="$(
  jq '[.[] | select(.previousStatus == "accepted" and .newStatus == "not-selected")] | length' "$body_file"
)"

if [[ "$not_selected_audit_count" != "1" ]]; then
  printf 'FAIL expected not-selected audit count=1, got %s\n' "$not_selected_audit_count" >&2
  jq . "$body_file"
  exit 1
fi

printf 'PASS not-selected proposal audit count=%s\n' "$not_selected_audit_count"

http_status="$(request GET "$api_url/challenges" "$startup_token")"
assert_status "$http_status" 200 "list startup marketplace after final selection"
startup_completed_count="$(
  jq --arg challenge_id "$challenge_id" '[.[] | select(.id == $challenge_id)] | length' "$body_file"
)"

if [[ "$startup_completed_count" != "0" ]]; then
  printf 'FAIL expected completed challenge hidden from startup marketplace, got %s\n' "$startup_completed_count" >&2
  jq . "$body_file"
  exit 1
fi

printf 'PASS completed challenge hidden from startup marketplace\n'
wait_for_startup_opportunity "$startup_token" "$challenge_id" "$proposal_one_id"
wait_for_selected_notification "$startup_token" "$proposal_one_id"
printf 'SMOKE_OK challenge_id=%s proposal_one=%s proposal_two=%s\n' "$challenge_id" "$proposal_one_id" "$proposal_two_id"
