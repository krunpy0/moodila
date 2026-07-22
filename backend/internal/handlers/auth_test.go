package handlers

import "testing"

func TestValidateRegistration(t *testing.T) {
	valid := credentials{
		Email:       "user@example.com",
		Password:    "password",
		Username:    "mood_user",
		DisplayName: "Mood User",
	}
	if err := validateRegistration(valid); err != nil {
		t.Fatalf("valid registration rejected: %v", err)
	}

	invalid := valid
	invalid.Password = "short"
	if err := validateRegistration(invalid); err == nil {
		t.Fatal("short password accepted")
	}
}
