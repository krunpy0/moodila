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

	validUsernames := []string{
		"mood_user",
		"user-123",
		"user.name",
		"ab",
		"user_with_dots.and-hyphens_99",
	}
	for _, u := range validUsernames {
		v := valid
		v.Username = u
		if err := validateRegistration(v); err != nil {
			t.Errorf("expected username %q to be valid, got: %v", u, err)
		}
	}

	invalidUsernames := []string{
		"a",
		"user@name",
		"user!name",
		"user space",
	}
	for _, u := range invalidUsernames {
		inv := valid
		inv.Username = u
		if err := validateRegistration(inv); err == nil {
			t.Errorf("expected username %q to be invalid, but it passed", u)
		}
	}

	invalid := valid
	invalid.Password = "short"
	if err := validateRegistration(invalid); err == nil {
		t.Fatal("short password accepted")
	}
}
