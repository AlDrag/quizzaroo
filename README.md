# Quizzaroo!

[Quizzaroo](https://aldrag.github.io/quizzaroo/)

## Development notes

- The HTTP request to fetch the stuff quizzes is cached to session storage when using localhost. This'll avoid excessive duplicate requests while developing, which could
have our privelage banned from either the proxy service or stuff.
- The quiz list comes from `quizzes.json`, refreshed every 6 hours by
`.github/workflows/update-quizzes.yml`. Stuff's CDN returns 406 to Cloudflare
egress, so the riddle proxy worker can't fetch it; a GitHub runner can. Run
`./fetch-quizzes.sh` to refresh it by hand.
- The riddle proxy worker is still required — it rewrites CSP and injects the
`postMessage`/`eval` bridge that `iframe-inject.js` needs.
