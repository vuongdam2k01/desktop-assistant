#!/usr/bin/env bash
# Kiểm chứng đầu vào spike trước khi bắt đầu M0.
# Chạy:  bash scripts/verify-inputs.sh
#
# Không sửa gì, chỉ đọc và báo cáo. An toàn để chạy lại nhiều lần.

set -uo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0; SKIP=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[33m–\033[0m %s\n' "$1"; SKIP=$((SKIP+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

command -v jq   >/dev/null || { echo "Thiếu jq — cài trước rồi chạy lại."; exit 1; }
command -v curl >/dev/null || { echo "Thiếu curl."; exit 1; }

[ -f .env.local ] || { echo "Không thấy .env.local. Copy từ .env.local.example rồi điền."; exit 1; }
set -a; . ./.env.local; set +a

filled() { [ -n "${!1:-}" ]; }

# ─── 1. LLM ──────────────────────────────────────────────────────────
head_ "1. LLM"

if ! filled LLM_BASE_URL || ! filled LLM_API_KEY; then
  skip "LLM_BASE_URL / LLM_API_KEY chưa điền — bỏ qua toàn bộ mục LLM"
else
  MODELS=$(curl -sS --max-time 30 "$LLM_BASE_URL/models" \
             -H "Authorization: Bearer $LLM_API_KEY" 2>/dev/null)
  if echo "$MODELS" | jq -e '.data' >/dev/null 2>&1; then
    N=$(echo "$MODELS" | jq '.data | length')
    ok "Endpoint trả lời, thấy $N model"
    echo "$MODELS" | jq -r '.data[].id' | head -20 | sed 's/^/      /'
    [ "$N" -ge 2 ] || printf '      \033[33m(chỉ 1 model — SP-10/SP-17 mất phần so sánh, không chặn)\033[0m\n'
  else
    bad "Không liệt kê được model từ $LLM_BASE_URL/models"
    echo "$MODELS" | head -c 300 | sed 's/^/      /'
  fi

  if filled LLM_MODEL_STRONG; then
    RESP=$(curl -sS --max-time 60 "$LLM_BASE_URL/chat/completions" \
      -H "Authorization: Bearer $LLM_API_KEY" -H 'Content-Type: application/json' \
      -d "$(jq -n --arg m "$LLM_MODEL_STRONG" '{
            model:$m, messages:[{role:"user",content:"Thời tiết Hà Nội thế nào? Bắt buộc dùng tool."}],
            tool_choice:"auto",
            tools:[{type:"function",function:{name:"get_weather",description:"Lấy thời tiết một thành phố",
              parameters:{type:"object",properties:{city:{type:"string"}},required:["city"]}}}]}')" 2>/dev/null)
    if echo "$RESP" | jq -e '.choices[0].message.tool_calls[0]' >/dev/null 2>&1; then
      ok "TOOL CALLING hoạt động trên $LLM_MODEL_STRONG"
    else
      bad "TOOL CALLING KHÔNG hoạt động trên $LLM_MODEL_STRONG — chặn SP-4, SP-6, SP-8"
      echo "$RESP" | head -c 300 | sed 's/^/      /'
    fi
  else
    skip "LLM_MODEL_STRONG chưa điền — không thử được tool calling"
  fi

  if filled LLM_MODEL_VISION; then
    # PNG đỏ 32x32 — BytePlus Ark từ chối ảnh nhỏ hơn 14px
    PNG='iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGO4I6dBU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAPhkiD2arPjkAAAAAElFTkSuQmCC'
    RESP=$(curl -sS --max-time 60 "$LLM_BASE_URL/chat/completions" \
      -H "Authorization: Bearer $LLM_API_KEY" -H 'Content-Type: application/json' \
      -d "$(jq -n --arg m "$LLM_MODEL_VISION" --arg p "data:image/png;base64,$PNG" '{
            model:$m, max_tokens:20, messages:[{role:"user",content:[
              {type:"text",text:"Ảnh này màu gì? Một từ."},{type:"image_url",image_url:{url:$p}}]}]}')" 2>/dev/null)
    if echo "$RESP" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
      ok "VISION hoạt động trên $LLM_MODEL_VISION"
    else
      bad "VISION không hoạt động trên $LLM_MODEL_VISION — nhánh đầu vào ảnh (FR-PET-04) không kiểm chứng được"
    fi
  else
    skip "LLM_MODEL_VISION chưa điền"
  fi
fi

# ─── 2. Notion ───────────────────────────────────────────────────────
head_ "2. Notion"

# Kiểm tra HAI TẦNG quyền của Notion: token hợp lệ + có nhánh nào được cấp chưa
check_notion() {                      # $1 nhãn  $2 tên biến token
  local label=$1 tok=${!2:-}
  if [ -z "$tok" ]; then skip "$label — $2 chưa điền"; return; fi

  local me ws
  me=$(curl -sS --max-time 30 "https://api.notion.com/v1/users/me" \
        -H "Authorization: Bearer $tok" -H 'Notion-Version: 2022-06-28' 2>/dev/null)
  if ! echo "$me" | jq -e '.bot' >/dev/null 2>&1; then
    bad "$label — token không hợp lệ: $(echo "$me" | jq -r '.message // .' | head -c 90)"; return
  fi
  ws=$(echo "$me" | jq -r '.bot.workspace_name // "?"')

  local n
  n=$(curl -sS --max-time 30 -X POST "https://api.notion.com/v1/search" \
        -H "Authorization: Bearer $tok" -H 'Notion-Version: 2022-06-28' \
        -H 'Content-Type: application/json' -d '{"page_size":100}' 2>/dev/null \
      | jq '.results | length' 2>/dev/null)

  if [ "${n:-0}" -gt 0 ]; then
    ok "$label — workspace '$ws', truy cập được $n đối tượng"
  else
    bad "$label — workspace '$ws', token hợp lệ nhưng CONTENT ACCESS RỖNG (0 đối tượng). Vào tab Content access của connection -> Add pages & databases"
  fi
}

check_notion "Notion A" NOTION_TOKEN_A
check_notion "Notion B" NOTION_TOKEN_B
check_notion "Notion C" NOTION_TOKEN_C

# ─── 3. Google ───────────────────────────────────────────────────────
head_ "3. Google (SP-13)"

G=secrets/google-oauth-client.json
if [ ! -f "$G" ]; then
  skip "Chưa có $G"
elif jq -e '.installed.client_id' "$G" >/dev/null 2>&1; then
  ok "OAuth client JSON đúng loại Desktop app"
elif jq -e '.web.client_id' "$G" >/dev/null 2>&1; then
  bad "JSON là loại 'web' — tạo lại client với Application type = Desktop app"
else
  bad "$G không đọc được hoặc sai định dạng"
fi
filled GOOGLE_TEST_USER_EMAIL && ok "Test user: $GOOGLE_TEST_USER_EMAIL" \
  || skip "GOOGLE_TEST_USER_EMAIL chưa điền"

# ─── 4. Rò rỉ ────────────────────────────────────────────────────────
head_ "4. An toàn"

if git check-ignore -q .env.local 2>/dev/null; then ok ".env.local đã được gitignore"
else bad ".env.local CHƯA được gitignore — dừng lại và sửa ngay"; fi
if git check-ignore -q secrets/google-oauth-client.json 2>/dev/null; then ok "secrets/ đã được gitignore"
else bad "secrets/ CHƯA được gitignore"; fi

printf '\n\033[1m%s\033[0m  %d đạt  ·  %d hỏng  ·  %d chưa điền\n\n' "TỔNG:" "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" -eq 0 ]
