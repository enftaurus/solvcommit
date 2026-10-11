# Sessions & Devices

> Device pairing lifecycle, token rotation with reuse detection, and IP address rules.
> Last updated: Phase 0 (Pre-implementation)

See [`docs/PRD.md#devices-and-sessions`](file:///home/rajababu/intern/leetsync/docs/PRD.md#devices-and-sessions) for the complete specification.

## Session Model
- **Device Pairing**: Extension pairs via authenticated handshake, receiving:
  - Short-lived Access Token (JWT or bearer token, e.g., 15 minutes).
  - High-entropy Refresh Token bound to a unique `token_family_id`.
- **Hashed Storage**: Only the `SHA-256` hash of the refresh token is stored in the database (`refresh_token_hash`). Plaintext tokens are never stored.
- **Rotation on Use**: Every call to `/devices/refresh` invalidates the presented refresh token and issues a new pair. The previous hash is retained to detect reuse.
- **Reuse Detection**: If an already-used or revoked refresh token is presented, the system detects a token breach, revokes the entire `token_family_id`, and invalidates all associated access.
- **Device Revocation**: Explicit revocation immediately marks `revoked_at` on the device record; subsequent API requests with that device token are rejected.

## Recorded Fields per Session
- `device_name`, `user_agent`: Displayed in the active sessions dashboard.
- `first_ip`, `last_ip`: Displayed as raw IP strings (no GeoIP lookup or alerts in MVP).
- `created_at`, `last_seen_at`: Displayed for session auditing and stale-session cleanup.
- `token_family_id`, `refresh_token_hash`: Internal security state for rotation and breach detection.
- `revoked_at`, `revoked_reason`: Audit history of session termination.

## IP Address Rules
1. **Never IP-bound**: Sessions are **never** bound to an IP address or terminated on IP change, supporting seamless transitions between Wi-Fi, mobile networks, and VPNs.
2. **Display only**: IP addresses are utilized solely for user dashboard display.
3. **Trusted Proxies**: Client IPs are read from `X-Forwarded-For` only when requests pass through the trusted proxy layer.
4. **Data Privacy**: Store only `first_ip` and `last_ip` (no IP history tables); rows are hard-deleted upon user account deletion.
