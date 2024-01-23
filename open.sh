#! /usr/bin/bash

# Opens the 4 most recent quizzes
# Dependencies:
# - Curl
# - JQ
# - internet

curl 'https://www.stuff.co.nz/_json/national/quizzes?limit=10' \
    | jq '.stories[] | {title: .title, url: .html_assets[0].data_content | capture("iframe.*src=\"(?<a>[^?]*)").a}' \
    | jq -r '"<a href=\"\(.url)\">\(.title)</a><br>"' \
    > /tmp/quizaroo.html

CMD=$(which xdg-open || which open)
$CMD /tmp/quizaroo.html
