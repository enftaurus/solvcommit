const test = require("node:test");
const assert = require("node:assert");

// Helper to simulate background PAIR_FROM_PORTAL handler logic
async function simulatePairFromPortal({
  senderUrl,
  expectedOrigin,
  payload,
  stored,
  setStorage,
}) {
  let senderOrigin = "";
  try {
    senderOrigin = new URL(senderUrl).origin;
  } catch (e) {
    return { ok: false, error: "invalid sender url" };
  }

  const expected = new URL(expectedOrigin).origin;
  const isAllowedOrigin =
    senderOrigin === expected ||
    senderOrigin.startsWith("http://localhost:") ||
    senderOrigin.startsWith("http://127.0.0.1:");

  if (!isAllowedOrigin) {
    return { ok: false, error: "origin mismatch" };
  }

  if (!stored.pair_state || stored.pair_state !== payload.state) {
    return { ok: false, error: "state mismatch or missing" };
  }

  if (!stored.pair_state_exp || stored.pair_state_exp < Date.now()) {
    return { ok: false, error: "pairing state expired" };
  }

  const deviceID = payload.deviceID || payload.device_id;
  const accessToken = payload.accessToken || payload.access_token;
  const refreshToken = payload.refreshToken || payload.refresh_token;

  if (!deviceID || !accessToken || !refreshToken) {
    return { ok: false, error: "missing pairing credentials" };
  }

  await setStorage({
    device_id: deviceID,
    access_token: accessToken,
    refresh_token: refreshToken,
    paired_at: new Date().toISOString(),
    pair_state: null,
    pair_state_exp: null,
  });

  return { ok: true };
}

test("Pairing from portal - Successful pairing stores credentials and clears state", async () => {
  let storage = {
    pair_state: "random-uuid-1234",
    pair_state_exp: Date.now() + 600000,
  };

  const payload = {
    state: "random-uuid-1234",
    deviceID: "dev_987",
    accessToken: "acc_token_abc",
    refreshToken: "ref_token_xyz",
  };

  const res = await simulatePairFromPortal({
    senderUrl: "http://localhost:8080/connect-extension?state=random-uuid-1234",
    expectedOrigin: "http://localhost:8080",
    payload,
    stored: storage,
    setStorage: async (data) => {
      Object.assign(storage, data);
    },
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(storage.device_id, "dev_987");
  assert.strictEqual(storage.access_token, "acc_token_abc");
  assert.strictEqual(storage.refresh_token, "ref_token_xyz");
  assert.strictEqual(storage.pair_state, null);
  assert.strictEqual(storage.pair_state_exp, null);
});

test("Pairing from portal - Rejects origin mismatch", async () => {
  let storage = {
    pair_state: "uuid-123",
    pair_state_exp: Date.now() + 600000,
  };

  const res = await simulatePairFromPortal({
    senderUrl: "https://evil.com/connect-extension",
    expectedOrigin: "http://localhost:8080",
    payload: { state: "uuid-123", deviceID: "d1", accessToken: "a1", refreshToken: "r1" },
    stored: storage,
    setStorage: async () => {},
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "origin mismatch");
});

test("Pairing from portal - Rejects state mismatch", async () => {
  let storage = {
    pair_state: "legit-state",
    pair_state_exp: Date.now() + 600000,
  };

  const res = await simulatePairFromPortal({
    senderUrl: "http://localhost:8080/connect-extension",
    expectedOrigin: "http://localhost:8080",
    payload: { state: "attacker-state", deviceID: "d1", accessToken: "a1", refreshToken: "r1" },
    stored: storage,
    setStorage: async () => {},
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "state mismatch or missing");
});

test("Pairing from portal - Rejects expired state", async () => {
  let storage = {
    pair_state: "expired-state",
    pair_state_exp: Date.now() - 1000, // expired 1s ago
  };

  const res = await simulatePairFromPortal({
    senderUrl: "http://localhost:8080/connect-extension",
    expectedOrigin: "http://localhost:8080",
    payload: { state: "expired-state", deviceID: "d1", accessToken: "a1", refreshToken: "r1" },
    stored: storage,
    setStorage: async () => {},
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "pairing state expired");
});
