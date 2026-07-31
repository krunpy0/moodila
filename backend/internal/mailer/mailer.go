package mailer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

type Mailer struct {
	APIKey    string
	FromEmail string
	DevMode   bool
	HTTPClient *http.Client
}

func New(apiKey, fromEmail string, devMode bool) Mailer {
	if fromEmail == "" {
		fromEmail = "onboarding@resend.dev"
	}
	return Mailer{
		APIKey:    apiKey,
		FromEmail: fromEmail,
		DevMode:   devMode,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

func (m Mailer) SendPasswordResetEmail(toEmail string, resetURL string, ttlMinutes int) error {
	// Graceful fallback when RESEND_API_KEY is empty
	if m.APIKey == "" {
		log.Printf("[DEV MAIL] Password reset link for %s: %s (expires in %d min)", toEmail, resetURL, ttlMinutes)
		return nil
	}

	subject := "Reset your password — Moodila"
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fbf9f8; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1b1c1c;">
  <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); padding: 32px;">
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <div style="width: 56px; height: 56px; border-radius: 50%%; background-color: #fce4ec; display: inline-block; line-height: 56px; font-size: 28px;">
          🌸
        </div>
        <h1 style="margin: 16px 0 8px 0; font-size: 24px; font-weight: 700; color: #1b1c1c;">Moodila</h1>
        <p style="margin: 0; font-size: 14px; color: #4d4447;">Password Reset Request</p>
      </td>
    </tr>
    <tr>
      <td style="font-size: 15px; line-height: 22px; color: #4d4447; padding-bottom: 24px;">
        Hello,<br><br>
        We received a request to reset your password for your Moodila account. Click the button below to choose a new password:
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <a href="%s" target="_blank" style="display: inline-block; background-color: #fce4ec; color: #76646b; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px;">Reset Password</a>
      </td>
    </tr>
    <tr>
      <td style="font-size: 13px; line-height: 20px; color: #7f7478; padding-bottom: 16px;">
        This link will expire in <strong>%d minutes</strong>. If you did not request a password reset, you can safely ignore this email, your password will remain unchanged.
      </td>
    </tr>
    <tr>
      <td style="font-size: 12px; line-height: 18px; color: #7f7478; border-top: 1px solid #f0eded; padding-top: 16px; word-break: break-all;">
        Or copy and paste this link into your browser:<br>
        <a href="%s" style="color: #6b5a60; text-decoration: underline;">%s</a>
      </td>
    </tr>
  </table>
</body>
</html>`, resetURL, ttlMinutes, resetURL, resetURL)

	reqData := resendRequest{
		From:    m.FromEmail,
		To:      []string{toEmail},
		Subject: subject,
		HTML:    htmlBody,
	}

	payload, err := json.Marshal(reqData)
	if err != nil {
		return fmt.Errorf("marshal resend req: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create resend req: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+m.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("send email via resend: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
