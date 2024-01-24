#! /usr/bin/bash

# Dependencies:
# - Curl
# - JQ
# - internet

curl 'https://www.stuff.co.nz/_json/national/quizzes?limit=100' \
    | jq '.stories | sort_by(.datetime_iso8601) | reverse[] | {title: .title, url: .html_assets[0].data_content | capture("iframe.*src=\"(?<a>[^?]*)").a}' \
    | jq -r '"<a href=\"\(.url)\">\(.title)</a><br>"' \
    > /tmp/quizaroo.html

CMD=$(which xdg-open || which open)
$CMD /tmp/quizaroo.html
