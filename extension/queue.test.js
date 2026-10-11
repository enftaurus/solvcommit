const test = require("node:test");
const assert = require("node:assert");
const { OfflineQueue } = require("./queue.js");

// In-memory mock storage
class MockStorage {
  constructor() {
    this.store = {};
  }
  async get(key) {
    return { [key]: this.store[key] };
  }
  async set(obj) {
    Object.assign(this.store, obj);
  }
}

test("OfflineQueue - Enqueue accepted submission", async () => {
  const storage = new MockStorage();
  const queue = new OfflineQueue(storage);

  const sub = {
    submission_id: "2138016677",
    problem_slug: "two-sum",
    problem_title: "Two Sum",
    language: "python3",
    code: "print('hello')",
    status: "Accepted"
  };

  const item = await queue.enqueue(sub);
  assert.strictEqual(item.submission_id, "2138016677");
  assert.strictEqual(item.attempts, 0);

  const items = await queue.getItems();
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].submission_id, "2138016677");
});

test("OfflineQueue - Rejects non-accepted submission (D-10)", async () => {
  const storage = new MockStorage();
  const queue = new OfflineQueue(storage);

  const sub = {
    submission_id: "2138016678",
    problem_slug: "two-sum",
    problem_title: "Two Sum",
    language: "python3",
    code: "print('hello')",
    status: "Wrong Answer"
  };

  await assert.rejects(async () => {
    await queue.enqueue(sub);
  }, /Only accepted submissions/);

  const items = await queue.getItems();
  assert.strictEqual(items.length, 0);
});

test("OfflineQueue - Transient failure applies exponential backoff", async () => {
  const storage = new MockStorage();
  const queue = new OfflineQueue(storage);

  await queue.enqueue({
    submission_id: "2138016677",
    problem_slug: "two-sum",
    problem_title: "Two Sum",
    language: "python3",
    code: "print('hello')",
    status: "Accepted"
  });

  // Mock API client simulating 503 Kafka Down / Network Error
  let callCount = 0;
  const failingApiClient = {
    submit: async () => {
      callCount++;
      const err = new Error("Kafka temporary error");
      err.status = 503;
      throw err;
    }
  };

  const res1 = await queue.process(failingApiClient);
  assert.strictEqual(res1.processed, 0);
  assert.strictEqual(res1.failed, 1);
  assert.strictEqual(res1.remaining, 1);
  assert.strictEqual(callCount, 1);

  const items = await queue.getItems();
  assert.strictEqual(items[0].attempts, 1);
  assert.ok(items[0].next_attempt_at > Date.now());

  // Second process call while backoff is active should skip item without network call
  const res2 = await queue.process(failingApiClient);
  assert.strictEqual(res2.processed, 0);
  assert.strictEqual(res2.failed, 0);
  assert.strictEqual(callCount, 1); // Not called again during backoff
});

test("OfflineQueue - Successful retry drains queue", async () => {
  const storage = new MockStorage();
  const queue = new OfflineQueue(storage);

  await queue.enqueue({
    submission_id: "2138016677",
    problem_slug: "two-sum",
    problem_title: "Two Sum",
    language: "python3",
    code: "print('hello')",
    status: "Accepted"
  });

  const successfulApiClient = {
    submit: async (item) => {
      return { status: "queued", submission_id: item.submission_id };
    }
  };

  const res = await queue.process(successfulApiClient);
  assert.strictEqual(res.processed, 1);
  assert.strictEqual(res.failed, 0);
  assert.strictEqual(res.remaining, 0);

  const items = await queue.getItems();
  assert.strictEqual(items.length, 0);
});

test("OfflineQueue - Permanent error (HTTP 422) is dropped from queue", async () => {
  const storage = new MockStorage();
  const queue = new OfflineQueue(storage);

  await queue.enqueue({
    submission_id: "2138016677",
    problem_slug: "two-sum",
    problem_title: "Two Sum",
    language: "python3",
    code: "print('hello')",
    status: "Accepted"
  });

  const unprocessableApiClient = {
    submit: async () => {
      const err = new Error("Unsupported language");
      err.status = 422;
      throw err;
    }
  };

  const res = await queue.process(unprocessableApiClient);
  assert.strictEqual(res.processed, 0);
  assert.strictEqual(res.failed, 1);
  assert.strictEqual(res.remaining, 0); // Dropped

  const items = await queue.getItems();
  assert.strictEqual(items.length, 0);
});

test("OfflineQueue - Backfill discovers and enqueues missing submissions (FR-ING-05)", async () => {
  const storage = new MockStorage();
  const queue = new OfflineQueue(storage);

  const mockLeetCode = {
    getRecentAcceptedIDs: async () => ["2138016677", "2138016678"],
    getSubmissionDetails: async (id) => ({
      submission_id: id,
      problem_slug: "two-sum",
      problem_title: "Two Sum",
      language: "python3",
      code: "print('" + id + "')",
      status: "Accepted"
    })
  };

  const submitted = [];
  const mockApi = {
    getMissingSubmissions: async (ids) => {
      // Backend says 2138016678 is missing
      return ["2138016678"];
    },
    submit: async (item) => {
      submitted.push(item.submission_id);
      return { status: "queued", submission_id: item.submission_id };
    }
  };

  const res = await queue.syncBackfill(mockApi, mockLeetCode);
  assert.strictEqual(res.missingCount, 1);
  assert.strictEqual(res.enqueuedCount, 1);
  assert.deepStrictEqual(submitted, ["2138016678"]);

  const items = await queue.getItems();
  assert.strictEqual(items.length, 0); // Processed and drained
});
