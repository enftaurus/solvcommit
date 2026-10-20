package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"leetsync/internal/api"
	"leetsync/internal/auth"
	"leetsync/internal/config"
	"leetsync/internal/database"
	"leetsync/internal/devices"
	"leetsync/internal/email"
	"leetsync/internal/github"
	"leetsync/internal/queue"
	"leetsync/internal/repositories"
	"leetsync/internal/submissions"
	"leetsync/internal/telemetry"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	logger := telemetry.InitLogger(cfg.AppEnv)
	logger.Info("Starting SolvCommit API server", "env", cfg.AppEnv, "addr", cfg.HTTPAddr)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to Database
	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	logger.Info("Connected to PostgreSQL successfully")

	// Kafka client
	kafkaClient := queue.NewClient(cfg.KafkaBrokers, cfg.KafkaTopic)
	if err := kafkaClient.Ping(ctx); err != nil {
		logger.Warn("Initial Kafka ping failed (service will retry on readiness probe)", "error", err)
	} else {
		logger.Info("Connected to Kafka successfully", "brokers", cfg.KafkaBrokers, "topic", cfg.KafkaTopic)
	}

	// Initialize domain services (Phase 2 & Phase 3)
	userSvc := auth.NewUserService(db.Pool)
	deviceSvc := devices.NewService(db.Pool, cfg.SessionSecret)
	submissionSvc := submissions.NewService(db.Pool, kafkaClient, cfg.MaxCodeBytes)

	// GitHub App client (configured from env if available)
	ghAppID := os.Getenv("GITHUB_APP_ID")
	ghKeyPath := os.Getenv("GITHUB_APP_PRIVATE_KEY_PATH")
	var ghAppPEM []byte
	if ghKeyPath != "" {
		ghAppPEM, _ = os.ReadFile(ghKeyPath)
	}
	var ghAppClient github.Client
	if ghAppID != "" && len(ghAppPEM) > 0 {
		concreteClient, clientErr := github.NewClient(ghAppID, ghAppPEM, "")
		if clientErr != nil {
			logger.Warn("Failed to initialize GitHub App client", "error", clientErr)
		} else {
			ghAppClient = concreteClient
		}
	}
	repoSvc := repositories.NewService(db.Pool, ghAppClient)

	// GitHub OAuth client (for web sign-in)
	ghClientID := os.Getenv("GITHUB_APP_CLIENT_ID")
	ghClientSecret := os.Getenv("GITHUB_APP_CLIENT_SECRET")
	var ghClient auth.GitHubClient
	if ghClientID != "" && ghClientSecret != "" {
		ghClient = auth.NewRealGitHubClient(ghClientID, ghClientSecret)
	}

	// Email sender (Phase 7: Transactional Email)
	emailSvc := email.NewSender(email.Config{
		Host:         cfg.SMTPHost,
		Port:         cfg.SMTPPort,
		User:         cfg.SMTPUser,
		Pass:         cfg.SMTPPass,
		From:         cfg.EmailFrom,
		SupportEmail: cfg.SupportEmail,
	}, logger)

	// Router (ponytail: stdlib net/http.ServeMux mounted via api package)
	handler := &api.Handler{
		DB:            db,
		Kafka:         kafkaClient,
		Users:         userSvc,
		Devices:       deviceSvc,
		Submissions:   submissionSvc,
		Repositories:  repoSvc,
		GitHub:        ghClient,
		Email:         emailSvc,
		SessionSecret: []byte(cfg.SessionSecret),
		AppEnv:        cfg.AppEnv,
		PublicURL:     cfg.PublicURL,
		GitHubAppSlug: cfg.GitHubAppSlug,
	}
	router := api.NewRouter(handler)

	server := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Server shutdown channel
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("API server crashed", "error", err)
			os.Exit(1)
		}
	}()

	logger.Info("SolvCommit API listening", "addr", cfg.HTTPAddr)

	<-shutdown
	logger.Info("Shutting down API server gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("API server forced shutdown", "error", err)
	}

	logger.Info("SolvCommit API server stopped")
}
