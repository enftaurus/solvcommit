package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds application configuration for LeetSync services
type Config struct {
	AppEnv        string
	HTTPAddr      string
	DatabaseURL   string
	KafkaBrokers  []string
	KafkaTopic    string
	SessionSecret string
	MaxCodeBytes  int64
}

// devSessionSecret is the insecure default used only in development.
const devSessionSecret = "dev-session-secret-at-least-32-bytes-long"

// Load reads environment variables with fallback to .env file if present
func Load() (*Config, error) {
	// Attempt to load .env if present (ponytail: minimal stdlib .env reader)
	loadDotEnv(".env")

	cfg := &Config{
		AppEnv:        getEnv("APP_ENV", "development"),
		HTTPAddr:      getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable"),
		KafkaTopic:    getEnv("KAFKA_TOPIC_SUBMISSIONS", "submissions"),
		SessionSecret: getEnv("SESSION_SECRET", devSessionSecret),
		MaxCodeBytes:  int64(getEnvInt("MAX_CODE_BYTES", 262144)), // 256 KB default
	}

	brokersStr := getEnv("KAFKA_BROKERS", "localhost:9092")
	cfg.KafkaBrokers = strings.Split(brokersStr, ",")
	for i := range cfg.KafkaBrokers {
		cfg.KafkaBrokers[i] = strings.TrimSpace(cfg.KafkaBrokers[i])
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if len(cfg.KafkaBrokers) == 0 || cfg.KafkaBrokers[0] == "" {
		return nil, fmt.Errorf("KAFKA_BROKERS is required")
	}

	// Issue 7: reject weak/default SESSION_SECRET in production
	if cfg.AppEnv == "production" {
		if cfg.SessionSecret == devSessionSecret || len(cfg.SessionSecret) < 32 {
			return nil, fmt.Errorf("SESSION_SECRET must be a strong random value (>=32 bytes) in production; refusing to start with dev default")
		}
	}

	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return defaultVal
}

// loadDotEnv parses key=val lines from a .env file without external dependencies (ponytail: stdlib)
func loadDotEnv(filename string) {
	file, err := os.Open(filename)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			// Strip quotes if present
			v = strings.Trim(v, `"'`)
			// Only set if not already set in environment
			if os.Getenv(k) == "" {
				os.Setenv(k, v)
			}
		}
	}
}
