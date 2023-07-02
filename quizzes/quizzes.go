package quizzes

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"regexp"
	"server/scraper"
	"strconv"

	"github.com/labstack/echo/v4"
)

func InitializeRoutes(e *echo.Echo) {
	e.GET("/quizzes", func(c echo.Context) error {
		limit := c.QueryParam("limit")
		stuffResp, err := http.Get("https://www.stuff.co.nz/_json/national/quizzes?limit=" + limit)
		if err != nil {
			panic("Failed to fetch Quizzes")
		}
		defer stuffResp.Body.Close()

		var q StuffQuizzesResponse
		err = json.NewDecoder(stuffResp.Body).Decode(&q)
		if err != nil {
			// http.Error(w, err.Error(), http.StatusBadRequest)
			// return
		}

		re := regexp.MustCompile(`data-rid-id="(\d+)`)
		var quizzes []QuizzesResponse
		for i := 0; i < len(q.Stories); i++ {
			matches := re.FindAllStringSubmatch(q.Stories[i].HTMLAssets[0].DataContent, -1)
			var id = matches[0][1]

			var response QuizzesResponse
			response.ID, _ = strconv.Atoi(id)
			response.Path = q.Stories[i].Path
			response.CategoryDescription = q.Stories[i].CategoryDescription
			response.Title = q.Stories[i].Title
			response.AltHeadline = q.Stories[i].AltHeadline

			quizzes = append(quizzes, response)
		}

		return c.JSON(http.StatusOK, quizzes)
	})

	e.GET("quizzes/:id", func(c echo.Context) error {
		id := c.Param("id")
		resp, err := http.Get("https://www.riddle.com/embed/a/" + id)
		if err != nil {
			panic("Failed to fetch Quiz information")
		}
		defer resp.Body.Close()

		htmlBytes, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			panic("Failed to fetch Quiz information")
		}

		return c.JSON(http.StatusOK, scraper.Scrape(string(htmlBytes)))
	})
}

type QuizzesResponse struct {
	ID                  int    `json:"id"`
	Path                string `json:"path"`
	CategoryDescription string `json:"category-description"`
	Title               string `json:"title"`
	AltHeadline         string `json:"alt_headline"`
}

type StuffQuizzesResponse struct {
	Stories []struct {
		ID                  int    `json:"id"`
		Path                string `json:"path"`
		URL                 string `json:"url"`
		CategoryDescription string `json:"category-description"`
		Title               string `json:"title"`
		AltHeadline         string `json:"alt_headline"`
		HTMLAssets          []struct {
			ID          int    `json:"id"`
			DataContent string `json:"data_content"`
		} `json:"html_assets"`
	} `json:"stories"`
}
