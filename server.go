package main

import (
	"server/quizzes"

	"github.com/labstack/echo/v4"
)

func main() {
	e := echo.New()
	quizzes.InitializeRoutes(e)
	e.Logger.Fatal(e.Start(":1323"))
}
