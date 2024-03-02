# Quizzaroo!

[Quizzaroo](https://aldrag.github.io/quizzaroo/)

## Development notes

- The HTTP request to fetch the stuff quizzes is cached to session storage when using localhost. This'll avoid excessive duplicate requests while developing, which could
have our privelage banned from either the proxy service or stuff.