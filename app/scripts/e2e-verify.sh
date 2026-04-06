#!/usr/bin/env bash
set -euo pipefail

# Showpane E2E Verification Script
# Runs the full Docker stack and tests all endpoints

BASE_URL="http://localhost:3000"
AUTH_SECRET="e2e-test-secret"
COOKIE_JAR="/tmp/showpane-e2e-cookies.txt"
PASSED=0
FAILED=0
TOTAL=20

cleanup() {
  rm -f "$COOKIE_JAR" /tmp/showpane-e2e-*.txt
  echo ""
  echo "Cleaning up Docker..."
  docker compose down -v --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

pass() { echo "  [PASS] $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  [FAIL] $1: $2"; FAILED=$((FAILED + 1)); }

echo "=== Showpane E2E Verification ==="
echo ""

# ─── Setup ──────────────────────────────────────────────────────────────────
echo "Starting Docker stack..."
docker compose down -v --remove-orphans 2>/dev/null || true
AUTH_SECRET="$AUTH_SECRET" docker compose up -d --build 2>&1 | tail -5

echo "Waiting for health check..."
for i in $(seq 1 60); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "Health check passed after ${i}s"
    break
  fi
  if [ "$i" = "60" ]; then
    echo "FATAL: Health check failed after 60s"
    exit 1
  fi
  sleep 1
done

echo "Seeding database..."
docker compose exec -T portal npx tsx prisma/seed.ts 2>&1 | tail -1

echo ""
echo "Running tests..."
echo ""

# ─── Test 1: Health endpoint ────────────────────────────────────────────────
BODY=$(curl -s "$BASE_URL/api/health")
if echo "$BODY" | grep -q '"status":"ok"'; then
  pass "1. Health endpoint returns ok"
else
  fail "1. Health endpoint" "got: $BODY"
fi

# ─── Test 2: Unauthenticated portal access → redirect ──────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-redirs 0 "$BASE_URL/client/example" 2>/dev/null || echo "000")
if [ "$CODE" = "307" ]; then
  pass "2. Unauthenticated portal access redirects (307)"
else
  fail "2. Unauthenticated portal access" "expected 307, got $CODE"
fi

# ─── Test 3: Unauthenticated file access → 401 ─────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/client-files/test.pdf")
if [ "$CODE" = "401" ]; then
  pass "3. Unauthenticated file access returns 401"
else
  fail "3. Unauthenticated file access" "expected 401, got $CODE"
fi

# ─── Test 4: Login with valid creds → 200 + cookie ─────────────────────────
BODY=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/client-auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"example","password":"demo123"}')
if echo "$BODY" | grep -q '"ok":true'; then
  pass "4. Login with valid creds returns ok"
else
  fail "4. Login with valid creds" "got: $BODY"
fi

# ─── Test 5: Login with wrong password → 401 ───────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/client-auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"example","password":"wrong"}')
if [ "$CODE" = "401" ]; then
  pass "5. Login with wrong password returns 401"
else
  fail "5. Login with wrong password" "expected 401, got $CODE"
fi

# ─── Test 6: Rate limiting → 429 ───────────────────────────────────────────
RATE_LIMITED=false
for i in $(seq 1 6); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/client-auth" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 198.51.100.99" \
    -d '{"username":"ratelimit","password":"wrong"}')
  if [ "$CODE" = "429" ]; then
    RATE_LIMITED=true
    break
  fi
done
if [ "$RATE_LIMITED" = "true" ]; then
  pass "6. Rate limiting returns 429 after repeated failures"
else
  fail "6. Rate limiting" "never got 429 after 6 attempts"
fi

# ─── Test 7: Authenticated portal access → 200 ─────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE_URL/client/example")
if [ "$CODE" = "200" ]; then
  pass "7. Authenticated portal access returns 200"
else
  fail "7. Authenticated portal access" "expected 200, got $CODE"
fi

# ─── Test 8: Wrong slug → redirect ─────────────────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-redirs 0 -b "$COOKIE_JAR" "$BASE_URL/client/other-slug" 2>/dev/null || echo "000")
if [ "$CODE" = "307" ]; then
  pass "8. Wrong slug redirects (307)"
else
  fail "8. Wrong slug" "expected 307, got $CODE"
fi

# ─── Test 9: Event tracking → 200 ──────────────────────────────────────────
BODY=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/client-events" \
  -H "Content-Type: application/json" \
  -d '{"event":"portal_view"}')
if echo "$BODY" | grep -q '"ok":true'; then
  pass "9. Event tracking returns ok"
else
  fail "9. Event tracking" "got: $BODY"
fi

# ─── Test 10: Events in DB ─────────────────────────────────────────────────
COUNT=$(docker compose exec -T db psql -U portal portal -t -c "SELECT count(*) FROM \"PortalEvent\"" 2>/dev/null | tr -d ' \n')
if [ -n "$COUNT" ] && [ "$COUNT" -gt 0 ] 2>/dev/null; then
  pass "10. Events recorded in DB (count: $COUNT)"
else
  fail "10. Events in DB" "count was: $COUNT"
fi

# ─── Test 11: Share link → 200 + shareUrl ───────────────────────────────────
BODY=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/client-auth/share")
if echo "$BODY" | grep -q '"shareUrl"'; then
  pass "11. Share link generation returns shareUrl"
  SHARE_URL=$(echo "$BODY" | grep -o '"shareUrl":"[^"]*"' | sed 's/"shareUrl":"//;s/"//')
else
  fail "11. Share link generation" "got: $BODY"
  SHARE_URL=""
fi

# ─── Test 12: Share link redemption → redirect + cookie ─────────────────────
if [ -n "$SHARE_URL" ]; then
  # Extract just the path from the share URL
  SHARE_PATH=$(echo "$SHARE_URL" | sed "s|.*://[^/]*||")
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-redirs 0 "$BASE_URL$SHARE_PATH" 2>/dev/null || echo "000")
  if [ "$CODE" = "307" ]; then
    pass "12. Share link redemption redirects (307)"
  else
    fail "12. Share link redemption" "expected 307, got $CODE"
  fi
else
  fail "12. Share link redemption" "no share URL from test 11"
fi

# ─── Test 13: File upload (operator) → 200 ──────────────────────────────────
echo "test file content" > /tmp/showpane-e2e-test.txt
BODY=$(curl -s -X POST "$BASE_URL/api/client-files/upload" \
  -H "Authorization: Bearer $AUTH_SECRET" \
  -F "file=@/tmp/showpane-e2e-test.txt;type=text/plain" \
  -F "portalSlug=example")
if echo "$BODY" | grep -q '"ok":true'; then
  pass "13. File upload (operator) returns ok"
else
  fail "13. File upload (operator)" "got: $BODY"
fi

# ─── Test 14: File list → 200 + file in array ───────────────────────────────
BODY=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/client-files")
if echo "$BODY" | grep -q 'showpane-e2e-test.txt'; then
  pass "14. File list includes uploaded file"
else
  fail "14. File list" "got: $BODY"
fi

# ─── Test 15: File download (authenticated) → 200 ───────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE_URL/api/client-files/showpane-e2e-test.txt")
if [ "$CODE" = "200" ]; then
  pass "15. File download (authenticated) returns 200"
else
  fail "15. File download (authenticated)" "expected 200, got $CODE"
fi

# ─── Test 16: File upload (client) → 200 ────────────────────────────────────
echo "client uploaded content" > /tmp/showpane-e2e-client.txt
BODY=$(curl -s -X POST -b "$COOKIE_JAR" "$BASE_URL/api/client-files/client-upload" \
  -F "file=@/tmp/showpane-e2e-client.txt;type=text/plain")
if echo "$BODY" | grep -q '"ok":true'; then
  pass "16. File upload (client) returns ok"
else
  fail "16. File upload (client)" "got: $BODY"
fi

# ─── Test 17: Backup creates file ───────────────────────────────────────────
BACKUP_DIR="/tmp/showpane-e2e-backups"
rm -rf "$BACKUP_DIR"
./scripts/backup.sh "$BACKUP_DIR" 2>&1 | tail -1
BACKUP_FILE=$(ls "$BACKUP_DIR"/showpane-backup-*.sql.gz 2>/dev/null | head -1)
if [ -n "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  pass "17. Backup creates non-empty file"
else
  fail "17. Backup" "no backup file found in $BACKUP_DIR"
fi

# ─── Test 18: Restore works ─────────────────────────────────────────────────
# Insert a marker row, restore from backup, verify marker is gone
docker compose exec -T db psql -U portal portal -c \
  "INSERT INTO \"PortalEvent\" (id, \"portalId\", event, detail) SELECT 'e2e-marker', id, 'e2e_test', 'marker' FROM \"ClientPortal\" LIMIT 1" 2>/dev/null
MARKER_BEFORE=$(docker compose exec -T db psql -U portal portal -t -c "SELECT count(*) FROM \"PortalEvent\" WHERE id='e2e-marker'" 2>/dev/null | tr -d ' \n')

if [ -n "$BACKUP_FILE" ]; then
  echo "yes" | ./scripts/restore.sh "$BACKUP_FILE" 2>&1 | tail -1
  MARKER_AFTER=$(docker compose exec -T db psql -U portal portal -t -c "SELECT count(*) FROM \"PortalEvent\" WHERE id='e2e-marker'" 2>/dev/null | tr -d ' \n')
  if [ "$MARKER_BEFORE" = "1" ] && [ "$MARKER_AFTER" = "0" ]; then
    pass "18. Restore removes post-backup data"
  else
    fail "18. Restore" "before=$MARKER_BEFORE, after=$MARKER_AFTER"
  fi
else
  fail "18. Restore" "no backup file from test 17"
fi

# ─── Test 19: Invalid JSON → 400 ───────────────────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/client-auth" \
  -H "Content-Type: application/json" \
  -d 'not json')
if [ "$CODE" = "400" ]; then
  pass "19. Invalid JSON returns 400"
else
  fail "19. Invalid JSON" "expected 400, got $CODE"
fi

# ─── Test 20: Invalid event type → 400 ─────────────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/client-events" \
  -H "Content-Type: application/json" \
  -d '{"event":"invalid_event_type"}')
if [ "$CODE" = "400" ]; then
  pass "20. Invalid event type returns 400"
else
  fail "20. Invalid event type" "expected 400, got $CODE"
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASSED/$TOTAL passed, $FAILED failed ==="

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
