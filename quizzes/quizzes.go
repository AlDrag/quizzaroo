package quizzes

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
