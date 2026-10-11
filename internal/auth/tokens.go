package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// GenerateRandomString generates a secure URL-safe random string
func GenerateRandomString(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// HashToken computes SHA-256 hex digest of a token (D-12, D-22)
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// DeviceAccessTokenPayload holds claims for device access tokens (ponytail: stdlib HMAC token)
type DeviceAccessTokenPayload struct {
	DeviceID string `json:"device_id"`
	UserID   string `json:"user_id"`
	FamilyID string `json:"family_id"`
	Exp      int64  `json:"exp"`
}

// MintDeviceAccessToken creates a signed access token valid for 15 minutes
func MintDeviceAccessToken(secret []byte, deviceID, userID, familyID string, ttl time.Duration) (string, error) {
	payload := DeviceAccessTokenPayload{
		DeviceID: deviceID,
		UserID:   userID,
		FamilyID: familyID,
		Exp:      time.Now().Add(ttl).Unix(),
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	sig := signString(secret, encodedPayload)

	return fmt.Sprintf("%s.%s", encodedPayload, sig), nil
}

// VerifyDeviceAccessToken verifies signature and expiration of device access token
func VerifyDeviceAccessToken(secret []byte, tokenStr string) (*DeviceAccessTokenPayload, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid token format")
	}

	encodedPayload, sig := parts[0], parts[1]
	expectedSig := signString(secret, encodedPayload)
	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return nil, errors.New("invalid token signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, errors.New("failed to decode token payload")
	}

	var payload DeviceAccessTokenPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, errors.New("failed to parse token payload")
	}

	if time.Now().Unix() > payload.Exp {
		return nil, errors.New("token expired")
	}

	return &payload, nil
}

// UserSessionPayload holds claims for web session cookie
type UserSessionPayload struct {
	UserID string `json:"user_id"`
	Exp    int64  `json:"exp"`
}

// MintSessionCookie creates a signed session cookie payload
func MintSessionCookie(secret []byte, userID string, ttl time.Duration) (string, error) {
	payload := UserSessionPayload{
		UserID: userID,
		Exp:    time.Now().Add(ttl).Unix(),
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	sig := signString(secret, encodedPayload)

	return fmt.Sprintf("%s.%s", encodedPayload, sig), nil
}

// VerifySessionCookie verifies signature and expiry of session cookie
func VerifySessionCookie(secret []byte, cookieVal string) (*UserSessionPayload, error) {
	parts := strings.Split(cookieVal, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid cookie format")
	}

	encodedPayload, sig := parts[0], parts[1]
	expectedSig := signString(secret, encodedPayload)
	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return nil, errors.New("invalid session signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, errors.New("failed to decode session payload")
	}

	var payload UserSessionPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, errors.New("failed to parse session payload")
	}

	if time.Now().Unix() > payload.Exp {
		return nil, errors.New("session expired")
	}

	return &payload, nil
}

func signString(secret []byte, data string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
