// LeetSync Extension - Offline Queue & Backfill Manager (FR-EXT-05, FR-ING-05)

class OfflineQueue {
  /**
   * @param {Object} storage - Storage adapter with get(key) and set(key, val) returning Promises
   */
  constructor(storage) {
    this.storage = storage;
    this.storageKey = "leetsync_offline_queue";
    this._lock = Promise.resolve();
  }

  _withLock(fn) {
    const next = this._lock.then(fn, fn);
    this._lock = next.catch(() => {});
    return next;
  }

  async getItems() {
    const data = await this.storage.get(this.storageKey);
    return (data && Array.isArray(data[this.storageKey])) ? data[this.storageKey] : [];
  }

  async saveItems(items) {
    await this.storage.set({ [this.storageKey]: items });
  }

  /**
   * Enqueue an accepted submission to the offline buffer (FR-EXT-05)
   */
  async enqueue(submission) {
    return this._withLock(async () => {
      if (!submission || !submission.submission_id) {
        throw new Error("Invalid submission item");
      }

      // Only accepted submissions can be queued (D-10)
      if (submission.status !== "Accepted") {
        throw new Error("Only accepted submissions can be enqueued");
      }

      const items = await this.getItems();
      const existingIndex = items.findIndex(i => String(i.submission_id) === String(submission.submission_id));

      const item = {
        ...submission,
        submission_id: String(submission.submission_id),
        attempts: 0,
        next_attempt_at: 0,
        queued_at: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        // Already queued; update code/details if needed
        items[existingIndex] = item;
      } else {
        items.push(item);
      }

      await this.saveItems(items);
      return item;
    });
  }

  /**
   * Remove a successfully processed or permanently rejected submission
   */
  async remove(submissionId) {
    return this._withLock(async () => {
      const items = await this.getItems();
      const filtered = items.filter(i => String(i.submission_id) !== String(submissionId));
      await this.saveItems(filtered);
    });
  }

  /**
   * Process all eligible items in the offline queue (FR-EXT-05, FR-ING-04)
   * @param {Object} apiClient - Client with submit(item)
   */
  async process(apiClient) {
    const items = await this.getItems();
    if (items.length === 0) return { processed: 0, failed: 0, remaining: 0 };

    const now = Date.now();
    let processedCount = 0;
    let failedCount = 0;
    const remainingItems = [];

    for (const item of items) {
      // Check backoff window
      if (item.next_attempt_at > now) {
        remainingItems.push(item);
        continue;
      }

      try {
        const result = await apiClient.submit(item);
        // Successful ingestion or idempotent duplicate accepted
        if (result && (result.status === "queued" || result.status === "processing" || result.status === "published")) {
          processedCount++;
          // Remove from queue
          continue;
        }
        throw new Error("Unexpected response status: " + (result ? result.status : "null"));
      } catch (err) {
        // If permanent error (HTTP 422: unprocessable, rejected status, invalid language)
        if (err.status === 422 || err.isPermanent) {
          console.warn(`[LeetSync Queue] Submission ${item.submission_id} permanently rejected:`, err.message);
          failedCount++;
          // Drop from queue to avoid infinite retry loops
          continue;
        }

        // Transient failure (HTTP 503, Kafka down, offline network): Apply exponential backoff with jitter
        item.attempts = (item.attempts || 0) + 1;
        const baseDelayMs = Math.min(300000, 1000 * Math.pow(2, item.attempts));
        const jitterMs = Math.floor(Math.random() * 500);
        item.next_attempt_at = now + baseDelayMs + jitterMs;
        item.last_error = err.message || "Network / server error";

        failedCount++;
        remainingItems.push(item);
      }
    }

    await this.saveItems(remainingItems);
    return {
      processed: processedCount,
      failed: failedCount,
      remaining: remainingItems.length
    };
  }

  /**
   * Run backfill discovery (FR-ING-05)
   * Lists recent submission IDs, sends to /sync/backfill, and enqueues missing ones
   */
  async syncBackfill(apiClient, leetcodeClient) {
    if (!leetcodeClient || !apiClient) return { missingCount: 0, enqueuedCount: 0 };

    // 1. Fetch recent accepted submission IDs from LeetCode session
    const recentIDs = await leetcodeClient.getRecentAcceptedIDs();
    if (!recentIDs || recentIDs.length === 0) {
      return { missingCount: 0, enqueuedCount: 0 };
    }

    // 2. Query backend for missing IDs
    const missingIDs = await apiClient.getMissingSubmissions(recentIDs);
    if (!missingIDs || missingIDs.length === 0) {
      return { missingCount: 0, enqueuedCount: 0 };
    }

    let enqueuedCount = 0;
    for (const missingId of missingIDs) {
      try {
        const details = await leetcodeClient.getSubmissionDetails(missingId);
        if (details && details.status === "Accepted") {
          await this.enqueue(details);
          enqueuedCount++;
        }
      } catch (err) {
        console.error(`[LeetSync Backfill] Failed to fetch details for missing submission ${missingId}:`, err);
      }
    }

    // Immediately trigger processing of newly enqueued items
    await this.process(apiClient);

    return {
      missingCount: missingIDs.length,
      enqueuedCount: enqueuedCount
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { OfflineQueue };
} else {
  self.OfflineQueue = OfflineQueue;
}
