package main

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"regexp"
	"server/quizzes"
	"server/scraper"

	"github.com/labstack/echo/v4"
)

func main() {
	e := echo.New()
	e.GET("/", func(c echo.Context) error {
		stuffResp, _ := http.Get("https://www.stuff.co.nz/_json/national/quizzes?limit=100")
		defer stuffResp.Body.Close()

		var q quizzes.StuffQuizzesResponse
		err := json.NewDecoder(stuffResp.Body).Decode(&q)
		if err != nil {
			// http.Error(w, err.Error(), http.StatusBadRequest)
			// return
		}

		re := regexp.MustCompile(`https://www\.riddle\.com/embed/a/\d+`)
		match := re.FindString(q.Stories[0].HTMLAssets[0].DataContent)

		resp, _ := http.Get(match)
		defer resp.Body.Close()

		htmlBytes, err := ioutil.ReadAll(resp.Body)

		return c.JSON(http.StatusOK, scraper.Scrape(string(htmlBytes)))
	})
	e.Logger.Fatal(e.Start(":1323"))
}
