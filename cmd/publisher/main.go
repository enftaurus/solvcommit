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

	// Worker shutdown channel
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	logger.Info("LeetSync Publisher scaffold ready, listening for shutdown signals...")

	// In Phase 4, the consumer worker loop runs here
	<-shutdown
	logger.Info("Shutting down Publisher worker gracefully...")

	// Allow brief cleanup
	time.Sleep(200 * time.Millisecond)
	logger.Info("LeetSync Publisher worker stopped")
}
