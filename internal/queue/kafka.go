package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"time"

	"leetsync/internal/submissions"

	"github.com/segmentio/kafka-go"
)

// Client handles Kafka connectivity and health checks
type Client struct {
	Brokers []string
	Topic   string
	writer  *kafka.Writer
}

// NewClient returns a new Kafka client wrapper
func NewClient(brokers []string, topic string) *Client {
	return &Client{
		Brokers: brokers,
		Topic:   topic,
		writer: &kafka.Writer{
			Addr:         kafka.TCP(brokers...),
			Topic:        topic,
			Balancer:     &kafka.Hash{}, // Keyed by user_id
			RequiredAcks: kafka.RequireAll,
			Async:        false, // Synchronous ack before response
		},
	}
}

// Close closes the underlying persistent Kafka writer
func (c *Client) Close() error {
	if c.writer != nil {
		return c.writer.Close()
	}
	return nil
}

// Ping verifies broker connectivity for readiness probe (D-03)
func (c *Client) Ping(ctx context.Context) error {
	if len(c.Brokers) == 0 {
		return fmt.Errorf("no kafka brokers configured")
	}

	// Dial first available broker
	for _, broker := range c.Brokers {
		conn, err := (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "tcp", broker)
		if err != nil {
			continue
		}
		_ = conn.Close()
		return nil
	}

	return fmt.Errorf("unable to reach any kafka broker in %v", c.Brokers)
}

// ProduceSubmission serializes and writes a submission message to Kafka (D-03, D-08, Issue 23)
func (c *Client) ProduceSubmission(ctx context.Context, msg *submissions.KafkaSubmissionMessage) error {
	payloadBytes, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal kafka payload: %w", err)
	}

	// Partition key is user_id so one user's commits remain ordered (PRD Kafka design)
	kafkaMsg := kafka.Message{
		Key:   []byte(msg.UserID),
		Value: payloadBytes,
		Time:  time.Now(),
	}

	return c.writer.WriteMessages(ctx, kafkaMsg)
}

// NewReader creates a consumer reader for the topic
func (c *Client) NewReader(groupID string) *kafka.Reader {
	return kafka.NewReader(kafka.ReaderConfig{
		Brokers:        c.Brokers,
		Topic:          c.Topic,
		GroupID:        groupID,
		MinBytes:       1,
		MaxBytes:       10e6, // 10MB
		CommitInterval: 0,    // Manual offset commit after GitHub publish & DB update
	})
}

// FormatSubID formats int64 submission ID to string for JSON/Kafka payloads (D-24)
func FormatSubID(id int64) string {
	return strconv.FormatInt(id, 10)
}
