#! /usr/bin/bash

# Opens the 4 most recent quizzes
# Dependencies:
# - Firefox
# - Curl
# - JQ
# - xargs
# - head
# - internet

curl https://www.stuff.co.nz/api/v1.0/stuff/page\?path=quizzes |\
   jq '.data[].stories[].content | {title, url}' |\
   jq -r '("https://www.stuff.co.nz" + .url)' |\
   head -n4 |\
   xargs firefox
