package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"leetsync/internal/config"
	"leetsync/internal/database"
	"leetsync/internal/github"
	"leetsync/internal/publisher"
	"leetsync/internal/queue"
	"leetsync/internal/telemetry"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	logger := telemetry.InitLogger(cfg.AppEnv)
	logger.Info("Starting LeetSync Publisher worker", "env", cfg.AppEnv)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to Database
	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("Publisher failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	logger.Info("Publisher connected to PostgreSQL successfully")

	// Kafka client
	kafkaClient := queue.NewClient(cfg.KafkaBrokers, cfg.KafkaTopic)
	if err := kafkaClient.Ping(ctx); err != nil {
		logger.Warn("Initial Kafka ping failed (publisher will wait)", "error", err)
	} else {
		logger.Info("Publisher connected to Kafka successfully", "brokers", cfg.KafkaBrokers, "topic", cfg.KafkaTopic)
	}

	// GitHub App client
	ghAppID := os.Getenv("GITHUB_APP_ID")
	ghKeyPath := os.Getenv("GITHUB_APP_PRIVATE_KEY_PATH")
	var ghAppPEM []byte
	if ghKeyPath != "" {
		ghAppPEM, _ = os.ReadFile(ghKeyPath)
	}
	var ghClient github.Client
	if ghAppID != "" && len(ghAppPEM) > 0 {
		ghClient, err = github.NewClient(ghAppID, ghAppPEM, "")
		if err != nil {
			logger.Warn("Failed to initialize GitHub App client", "error", err)
		}
	}

	// Initialize Publisher Worker
	worker := publisher.NewWorker(db.Pool, ghClient, logger)
	reader := kafkaClient.NewReader("leetsync-publisher")
	defer reader.Close()

	// Start consumer in background goroutine
	go func() {
		if err := worker.RunConsumer(ctx, reader); err != nil {
			logger.Error("Publisher consumer loop error", "error", err)
		}
	}()

	logger.Info("LeetSync Publisher worker running and listening for submissions")

	// Worker shutdown channel
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	<-shutdown
	logger.Info("Shutting down Publisher worker gracefully...")
	cancel()

	// Allow brief cleanup
	time.Sleep(300 * time.Millisecond)
	logger.Info("LeetSync Publisher worker stopped cleanly")
}
