#! /usr/bin/env bash

# Fetches the latest stuff quiz metadata and writes it to quizzes.json.
# Run by .github/workflows/update-quizzes.yml, but safe to run by hand.
#
# Dependencies:
# - Curl
# - JQ
# - internet

set -euo pipefail

OUT="$(dirname "$0")/quizzes.json"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Stuff blocks Cloudflare egress, so this has to run somewhere else (a GitHub
# runner, or your machine) rather than from the riddle proxy worker.
curl --fail --silent --show-error \
    -H 'User-Agent: Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.166 Safari/537.36' \
    'https://www.stuff.co.nz/_json/national/quizzes?limit=51' \
    | jq '{
        stories: [
          .stories[]
          | {
              id,
              title,
              datetime_iso8601,
              embed: ([(.html_assets[0].data_content // "") | capture("iframe.*src=\"(?<a>[^?]*)").a] | first // "")
            }
        ] | sort_by(.datetime_iso8601) | reverse
      }' > "$TMP"

# Never overwrite good data with a scrape that came back broken.
TOTAL=$(jq '.stories | length' "$TMP")
EMBEDS=$(jq '[.stories[] | select(.embed != "")] | length' "$TMP")
if [ "$TOTAL" -eq 0 ] || [ "$EMBEDS" -eq 0 ]; then
    echo "Refusing to write: $TOTAL stories, $EMBEDS with an embed URL." >&2
    exit 1
fi

mv "$TMP" "$OUT"
trap - EXIT
echo "Wrote $OUT: $TOTAL stories, $EMBEDS with an embed URL."
