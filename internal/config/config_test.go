package config_test

import (
	"os"
	"testing"

	"leetsync/internal/config"
)

func TestConfigLoadDefaults(t *testing.T) {
	// Clear environment overrides
	os.Unsetenv("APP_ENV")
	os.Unsetenv("HTTP_ADDR")
	os.Unsetenv("KAFKA_BROKERS")
	os.Unsetenv("KAFKA_TOPIC_SUBMISSIONS")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("expected config to load successfully, got error: %v", err)
	}

	if cfg.AppEnv == "" {
		t.Errorf("expected default AppEnv to be set")
	}
	if cfg.HTTPAddr != ":8080" {
		t.Errorf("expected default HTTPAddr :8080, got %s", cfg.HTTPAddr)
	}
	if cfg.KafkaTopic != "submissions" {
		t.Errorf("expected default KafkaTopic submissions, got %s", cfg.KafkaTopic)
	}
	if len(cfg.KafkaBrokers) == 0 {
		t.Errorf("expected KafkaBrokers to have default values")
	}
}

func TestConfigCustomEnv(t *testing.T) {
	os.Setenv("APP_ENV", "production")
	os.Setenv("SESSION_SECRET", "super-secret-random-production-key-at-least-32-bytes")
	os.Setenv("PUBLIC_URL", "https://solvcommit.dev")
	os.Setenv("GITHUB_APP_ID", "12345")
	os.Setenv("GITHUB_APP_PRIVATE_KEY_PATH", "/path/to/key.pem")
	os.Setenv("HTTP_ADDR", ":9000")
	os.Setenv("KAFKA_BROKERS", "broker1:9092,broker2:9092")
	defer func() {
		os.Unsetenv("APP_ENV")
		os.Unsetenv("SESSION_SECRET")
		os.Unsetenv("PUBLIC_URL")
		os.Unsetenv("GITHUB_APP_ID")
		os.Unsetenv("GITHUB_APP_PRIVATE_KEY_PATH")
		os.Unsetenv("HTTP_ADDR")
		os.Unsetenv("KAFKA_BROKERS")
	}()

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.AppEnv != "production" {
		t.Errorf("expected AppEnv production, got %s", cfg.AppEnv)
	}
	if cfg.HTTPAddr != ":9000" {
		t.Errorf("expected HTTPAddr :9000, got %s", cfg.HTTPAddr)
	}
	if len(cfg.KafkaBrokers) != 2 || cfg.KafkaBrokers[0] != "broker1:9092" || cfg.KafkaBrokers[1] != "broker2:9092" {
		t.Errorf("expected 2 brokers, got %v", cfg.KafkaBrokers)
	}
}

func TestConfigProductionRejectsDefaultSecret(t *testing.T) {
	os.Setenv("APP_ENV", "production")
	os.Unsetenv("SESSION_SECRET")
	os.Setenv("PUBLIC_URL", "https://solvcommit.dev")
	os.Setenv("GITHUB_APP_ID", "12345")
	os.Setenv("GITHUB_APP_PRIVATE_KEY_PATH", "/path/to/key.pem")
	defer func() {
		os.Unsetenv("APP_ENV")
		os.Unsetenv("PUBLIC_URL")
		os.Unsetenv("GITHUB_APP_ID")
		os.Unsetenv("GITHUB_APP_PRIVATE_KEY_PATH")
	}()

	_, err := config.Load()
	if err == nil {
		t.Fatalf("expected error when starting production with default secret, got nil")
	}
}

func TestConfigProductionRejectsMissingAppID(t *testing.T) {
	os.Setenv("APP_ENV", "production")
	os.Setenv("SESSION_SECRET", "super-secret-random-production-key-at-least-32-bytes")
	os.Setenv("PUBLIC_URL", "https://solvcommit.dev")
	os.Unsetenv("GITHUB_APP_ID")
	os.Setenv("GITHUB_APP_PRIVATE_KEY_PATH", "/path/to/key.pem")
	defer func() {
		os.Unsetenv("APP_ENV")
		os.Unsetenv("SESSION_SECRET")
		os.Unsetenv("PUBLIC_URL")
		os.Unsetenv("GITHUB_APP_PRIVATE_KEY_PATH")
	}()

	_, err := config.Load()
	if err == nil {
		t.Fatalf("expected error when starting production with missing GITHUB_APP_ID, got nil")
	}
}

func TestConfigProductionRejectsShortSecret(t *testing.T) {
	os.Setenv("APP_ENV", "production")
	os.Setenv("SESSION_SECRET", "too-short")
	os.Setenv("PUBLIC_URL", "https://solvcommit.dev")
	os.Setenv("GITHUB_APP_ID", "12345")
	os.Setenv("GITHUB_APP_PRIVATE_KEY_PATH", "/path/to/key.pem")
	defer func() {
		os.Unsetenv("APP_ENV")
		os.Unsetenv("SESSION_SECRET")
		os.Unsetenv("PUBLIC_URL")
		os.Unsetenv("GITHUB_APP_ID")
		os.Unsetenv("GITHUB_APP_PRIVATE_KEY_PATH")
	}()

	_, err := config.Load()
	if err == nil {
		t.Fatalf("expected error when starting production with short secret, got nil")
	}
}
