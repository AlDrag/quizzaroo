package scraper

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"golang.org/x/net/html"
)

func Scrape(htmlContent string) *Quiz {
	// Parse the HTML string
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		// log.Fatal(err)
	}

	// Find the script tag containing "window.riddle_view"
	var extractScriptContent func(*html.Node) (string, bool)
	extractScriptContent = func(n *html.Node) (string, bool) {
		if n.Type == html.ElementNode && n.Data == "script" {
			var content string
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.TextNode {
					content += c.Data
				}
			}
			if strings.Contains(content, "window.riddle_view") {
				return strings.Replace(strings.TrimSpace(content), "window.riddle_view = ", "", -1), true
			}
			return "", false
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if content, found := extractScriptContent(c); found {
				return strings.Replace(strings.TrimSpace(content), "window.riddle_view = ", "", -1), true
			}
		}
		return "", false
	}

	scriptContent, _ := extractScriptContent(doc)
	// fmt.Println(scriptContent)

	obj, _ := extractObject(scriptContent)

	fmt.Println(obj.ID)
	fmt.Println(obj.Status)

	return obj
}

func extractObject(code string) (*Quiz, error) {
	quiz := Quiz{}
	start := 0
	level := 0

	for i, char := range code {
		if char == '{' {
			if level == 1 {
				start = i
			}
			level++
		} else if char == '}' {
			level--
			if level == 1 {
				err := json.Unmarshal([]byte(code[start:i+1]), &quiz)
				if err != nil {
					return nil, err
				}
				return &quiz, nil
			}
		}
	}

	return nil, fmt.Errorf("No object found in the code")
}

type Quiz struct {
	ID     int `json:"id"`
	UID    int `json:"uid"`
	Status int `json:"status"`
	Data   struct {
		TypeID     string `json:"typeId"`
		PageGroups []struct {
			TemplateID string `json:"templateId"`
			Pages      []struct {
				TemplateID string `json:"templateId"`
				Image      struct {
					Type        string `json:"type"`
					Width       int    `json:"width"`
					Height      int    `json:"height"`
					IsCDN       bool   `json:"isCDN"`
					Original    string `json:"original"`
					OriginalID  string `json:"originalId"`
					SrcCDN      string `json:"srcCDN"`
					ShareSrcCDN string `json:"shareSrcCDN"`
				} `json:"image"`
				Title      string `json:"title"`
				ID         int    `json:"id"`
				TitlePlain string `json:"title_plain"`
			} `json:"pages"`
			NextID int `json:"nextId"`
		} `json:"pageGroups"`
		Title string `json:"title"`
		Desc  string `json:"desc"`
		Image struct {
			Type        string `json:"type"`
			Width       int    `json:"width"`
			Height      int    `json:"height"`
			IsCDN       bool   `json:"isCDN"`
			Original    string `json:"original"`
			OriginalID  string `json:"originalId"`
			SrcCDN      string `json:"srcCDN"`
			ShareSrcCDN string `json:"shareSrcCDN"`
		} `json:"image"`
		Options struct {
			Color      string `json:"color"`
			Theme      string `json:"theme"`
			Font       string `json:"font"`
			CustomFont struct {
				Type string `json:"type"`
				Vars struct {
					Families string `json:"families"`
				} `json:"vars"`
				Styles struct {
					Body   string `json:"body"`
					Header string `json:"header"`
					Button string `json:"button"`
					Choice string `json:"choice"`
				} `json:"styles"`
			} `json:"customFont"`
			Language    string `json:"language"`
			HideIntro   bool   `json:"hideIntro"`
			HidePercent bool   `json:"hidePercent"`
			OverrideCSS string `json:"overrideCss"`
			ImageAspect string `json:"imageAspect"`
			FooterText  struct {
				Text     string `json:"text"`
				Plain    string `json:"plain"`
				Allpages bool   `json:"allpages"`
			} `json:"footer_text"`
			Logo struct {
				Type  string `json:"type"`
				Image struct {
					Width       int    `json:"width"`
					Height      int    `json:"height"`
					Type        string `json:"type"`
					Format      string `json:"format"`
					IsCDN       bool   `json:"isCDN"`
					Original    string `json:"original"`
					OriginalID  string `json:"originalId"`
					SrcCDN      string `json:"srcCDN"`
					ShareSrcCDN string `json:"shareSrcCDN"`
				} `json:"image"`
				Width  int    `json:"width"`
				Height int    `json:"height"`
				Align  string `json:"align"`
				Color  string `json:"color"`
				Link   string `json:"link"`
			} `json:"logo"`
			CustomTweet struct {
				Enabled bool   `json:"enabled"`
				Text    string `json:"text"`
			} `json:"customTweet"`
			Integration struct {
				Webhook struct {
					Enable bool   `json:"enable"`
					URL    string `json:"url"`
				} `json:"webhook"`
				CustomLandingpage struct {
					Enable         bool   `json:"enable"`
					URL            string `json:"url"`
					Mode           string `json:"mode"`
					IndividualUrls struct {
						Num1 struct {
							ID    int    `json:"id"`
							Label string `json:"label"`
							Value string `json:"value"`
						} `json:"1"`
						Num2 struct {
							ID    int    `json:"id"`
							Label string `json:"label"`
							Value string `json:"value"`
						} `json:"2"`
						Num3 struct {
							ID    int    `json:"id"`
							Label string `json:"label"`
							Value string `json:"value"`
						} `json:"3"`
					} `json:"individual_urls"`
					WithoutData bool `json:"withoutData"`
				} `json:"customLandingpage"`
			} `json:"integration"`
			CustomFooter struct {
				Enabled bool   `json:"enabled"`
				HTML    string `json:"html"`
			} `json:"customFooter"`
			NextDelay                      int  `json:"nextDelay"`
			ShowResultOverviewExplanation  bool `json:"showResultOverviewExplanation"`
			ShowResultOverviewPercent      bool `json:"showResultOverviewPercent"`
			ShowResultOverviewCorrectWrong bool `json:"showResultOverviewCorrectWrong"`
			CorrectWrong                   struct {
				Hide            bool   `json:"hide"`
				TextIsCorrect   string `json:"textIsCorrect"`
				TextIsIncorrect string `json:"textIsIncorrect"`
			} `json:"correctWrong"`
			CallToActionButton struct {
				BtnSize         string `json:"btnSize"`
				BtnPosition     string `json:"btnPosition"`
				BtnHorizontal   string `json:"btnHorizontal"`
				URL             string `json:"url"`
				FontColor       string `json:"fontColor"`
				BackgroundColor string `json:"backgroundColor"`
				BorderRadius    int    `json:"borderRadius"`
				OpenInNewTab    bool   `json:"openInNewTab"`
				Show            bool   `json:"show"`
				Text            string `json:"text"`
			} `json:"callToActionButton"`
			Template    string `json:"template"`
			AutoHeight  bool   `json:"autoHeight"`
			FontColor   string `json:"font_color"`
			ButtonColor string `json:"button_color"`
			BgColor     string `json:"bg_color"`
			BgPattern   struct {
				Name            string `json:"name"`
				BackgroundImage string `json:"background_image"`
			} `json:"bg_pattern"`
			TextLinkColor     string    `json:"text_link_color"`
			FocusColorEnabled bool      `json:"focus_color_enabled"`
			FocusBtnColor     string    `json:"focus_btn_color"`
			FocusColor        string    `json:"focus_color"`
			PollAutoCloseDate time.Time `json:"pollAutoCloseDate"`
			PollAutoOpenDate  time.Time `json:"pollAutoOpenDate"`
			RevealAt          time.Time `json:"revealAt"`
			Security          struct {
				Voting struct {
					IPLimit struct {
						Enabled bool   `json:"enabled"`
						Period  string `json:"period"`
						Limit   int    `json:"limit"`
					} `json:"ipLimit"`
				} `json:"voting"`
			} `json:"security"`
			HideStartpage       bool   `json:"hideStartpage"`
			TextStartBtn        string `json:"textStartBtn"`
			TextNextBtn         string `json:"textNextBtn"`
			TextPlayAgain       string `json:"textPlayAgain"`
			RightToLeft         bool   `json:"rightToLeft"`
			IsRandomAnswerOrder bool   `json:"isRandomAnswerOrder"`
			BgImage             []any  `json:"bg_image"`
			CustomGDRPtext      string `json:"customGDRPtext"`
			FacebookWhiteLabel  bool   `json:"facebookWhiteLabel"`
			OpenInNewTab        bool   `json:"openInNewTab"`
		} `json:"options"`
		Leadgen struct {
			Config struct {
				ShowLeadgenBanner   bool   `json:"showLeadgenBanner"`
				ShowIframeBanner    bool   `json:"showIframeBanner"`
				CurrentTab          int    `json:"currentTab"`
				FormType            string `json:"formType"`
				ConnectedApp        string `json:"connectedApp"`
				SaveApp             string `json:"saveApp"`
				AllowSkip           bool   `json:"allowSkip"`
				SkipButtonText      string `json:"skipButtonText"`
				SendButtonText      string `json:"sendButtonText"`
				SaveByRiddle        bool   `json:"saveByRiddle"`
				ShowSaveByRiddle    bool   `json:"showSaveByRiddle"`
				AskAnswerPermission bool   `json:"askAnswerPermission"`
				FontColor           string `json:"fontColor"`
				Font                string `json:"font"`
				CustomFontStyles    struct {
					Body   string `json:"body"`
					Labels string `json:"labels"`
					Button string `json:"button"`
					Desc   string `json:"desc"`
				} `json:"customFontStyles"`
				BackgroundColor     string `json:"backgroundColor"`
				AllowBgImage        bool   `json:"allowBgImage"`
				BackgroundImage     []any  `json:"backgroundImage"`
				BackgroundSize      string `json:"backgroundSize"`
				BackgroundPosition  string `json:"backgroundPosition"`
				BackgroundRepeat    string `json:"backgroundRepeat"`
				ButtonPosHorizontal string `json:"buttonPosHorizontal"`
				ButtonsLayout       string `json:"buttonsLayout"`
				ButtonsOrder        string `json:"buttonsOrder"`
				SubmitBtnStyle      string `json:"submitBtnStyle"`
				SubmitBtnTextColor  string `json:"submitBtnTextColor"`
				SkipBtnStyle        string `json:"skipBtnStyle"`
				SkipBtnBgColor      string `json:"skipBtnBgColor"`
				SkipBtnTextColor    string `json:"skipBtnTextColor"`
				Doi                 struct {
					Enable                  bool   `json:"enable"`
					EmailFieldID            any    `json:"emailFieldId"`
					EmailSubject            string `json:"emailSubject"`
					EmailBody               string `json:"emailBody"`
					EmailBodyRaw            string `json:"emailBodyRaw"`
					CustomConfirmationPage  bool   `json:"customConfirmationPage"`
					ConfirmationRedirect    string `json:"confirmationRedirect"`
					ConfirmationPageTitle   string `json:"confirmationPageTitle"`
					ConfirmationPageBody    string `json:"confirmationPageBody"`
					ConfirmationPageBodyRaw string `json:"confirmationPageBodyRaw"`
				} `json:"doi"`
			} `json:"config"`
			EmbedDataMapping []any `json:"embedDataMapping"`
			Form             struct {
				Enable   bool  `json:"enable"`
				Elements []any `json:"elements"`
			} `json:"form"`
			Iframe struct {
				Enable      bool   `json:"enable"`
				URL         string `json:"url"`
				Height      int    `json:"height"`
				DisableSkip bool   `json:"disableSkip"`
			} `json:"iframe"`
			Integration struct {
				Connect []any `json:"connect"`
				Save    []any `json:"save"`
			} `json:"integration"`
		} `json:"leadgen"`
		Info struct {
			StatVersion                  int     `json:"statVersion"`
			QuestionOrderHistory         [][]int `json:"questionOrderHistory"`
			LazyImages                   bool    `json:"lazyImages"`
			CustomLandingpageWithoutData bool    `json:"customLandingpageWithoutData"`
		} `json:"info"`
		Published struct {
			User int `json:"user"`
			Date int `json:"date"`
		} `json:"published"`
	} `json:"data"`
	Title string `json:"title"`
	Type  string `json:"type"`
	User  struct {
		SubscriptionDetail struct {
			Active   bool     `json:"active"`
			Features []string `json:"features"`
		} `json:"subscription_detail"`
	} `json:"user"`
	Language          string `json:"language"`
	CustomerSlug      any    `json:"customerSlug"`
	CtaDescription    string `json:"ctaDescription"`
	LoadVueJs         bool   `json:"loadVueJs"`
	CustomFooterHTML  string `json:"customFooterHtml"`
	CustomVideoPlayer string `json:"customVideoPlayer"`
}
