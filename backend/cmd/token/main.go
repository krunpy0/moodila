package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"moodshare/internal/config"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
)

func main() {
	cfg := config.Load()

	if cfg.GoogleClientID == "" || cfg.GoogleClientSecret == "" {
		log.Fatalf("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in backend/.env")
	}

	redirectURI := "http://localhost:8080/auth/google/callback"
	if osRedirect := getenv("GOOGLE_REDIRECT_URI", ""); osRedirect != "" {
		redirectURI = osRedirect
	}

	oauthCfg := &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  redirectURI,
		Scopes:       []string{drive.DriveFileScope},
		Endpoint:     google.Endpoint,
	}

	authURL := oauthCfg.AuthCodeURL("state-token", oauth2.AccessTypeOffline, oauth2.ApprovalForce)

	codeChan := make(chan string, 1)

	// Try starting a temporary HTTP callback server on port 8080 if not occupied by main API
	u, err := url.Parse(redirectURI)
	if err == nil && u.Port() != "" {
		srv := &http.Server{Addr: ":" + u.Port()}
		http.HandleFunc(u.Path, func(w http.ResponseWriter, r *http.Request) {
			code := r.URL.Query().Get("code")
			if code != "" {
				codeChan <- code
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				fmt.Fprint(w, `<h2>✅ Авторизация успешна!</h2><p>Токен получен в консоли. Можете закрыть эту вкладку.</p>`)
			} else {
				http.Error(w, "No code in callback", http.StatusBadRequest)
			}
		})
		go func() {
			_ = srv.ListenAndServe()
		}()
		defer srv.Shutdown(context.Background())
	}

	fmt.Println("==================================================================")
	fmt.Println("GOOGLE DRIVE OAUTH2 REFRESH TOKEN GENERATOR")
	fmt.Println("==================================================================")
	fmt.Println("1. Перейдите по этой ссылке в браузере:")
	fmt.Println()
	fmt.Println(authURL)
	fmt.Println()
	fmt.Println("2. Зайдите под своим личным Google-аккаунтом и нажмите 'Разрешить'.")
	fmt.Println("3. Если токен не перехвачен автоматически, скопируйте параметр 'code'")
	fmt.Println("   из адресной строки (адрес вида http://localhost:8080/auth/google/callback?code=4/0A...)")
	fmt.Println("   и вставьте его ниже:")
	fmt.Print("> ")

	var code string

	select {
	case code = <-codeChan:
		fmt.Println("(автоматически получен из браузера!)")
	default:
		// Prompt for manual code input
		go func() {
			var input string
			if _, err := fmt.Scan(&input); err == nil {
				input = strings.TrimSpace(input)
				// If full URL pasted by accident, extract code
				if strings.Contains(input, "code=") {
					if parsed, err := url.Parse(input); err == nil {
						input = parsed.Query().Get("code")
					}
				}
				codeChan <- input
			}
		}()

		select {
		case code = <-codeChan:
		case <-time.After(5 * time.Minute):
			log.Fatalf("Превышено время ожидания авторизации (5 минут)")
		}
	}

	tok, err := oauthCfg.Exchange(context.Background(), code)
	if err != nil {
		log.Fatalf("Ошибка получения токена: %v", err)
	}

	fmt.Println("\n==================================================================")
	fmt.Println("УСПЕХ! Ваш GDRIVE_REFRESH_TOKEN:")
	fmt.Println("==================================================================")
	fmt.Println(tok.RefreshToken)
	fmt.Println("==================================================================")
	fmt.Println("\nДобавьте эту строку в backend/.env и в настройки Render.com:")
	fmt.Printf("GDRIVE_REFRESH_TOKEN=%s\n", tok.RefreshToken)
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
