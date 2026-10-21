import React, { useState } from "react";
import {
  ShieldAlert,
  Pause,
  Play,
  Github,
  Trash2,
  AlertTriangle,
  Chrome,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { UserProfile, SyncStatus } from "../types";
import { api } from "../api";

interface AccountSettingsProps {
  user: UserProfile;
  syncStatus: SyncStatus;
  onRefreshStatus: () => void;
  onNotify: (msg: string, type?: "success" | "error") => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  syncStatus,
  onRefreshStatus,
  onNotify,
}) => {
  const [isTogglingSync, setIsTogglingSync] = useState(false);
  const [activeBrowserTab, setActiveBrowserTab] = useState<"chrome" | "firefox">("chrome");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleSync = async () => {
    setIsTogglingSync(true);
    try {
      if (syncStatus.is_paused) {
        await api.resumeSync();
        onNotify("Publishing pipeline resumed", "success");
      } else {
        await api.pauseSync();
        onNotify("Publishing pipeline paused", "success");
      }
      onRefreshStatus();
    } catch (err: any) {
      onNotify(err.message || "Failed to update sync state", "error");
    } finally {
      setIsTogglingSync(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationInput !== "DELETE") return;
    setIsDeleting(true);
    try {
      await api.deleteMe();
      window.location.href = "/";
    } catch (err: any) {
      onNotify(err.message || "Failed to delete account", "error");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Settings
          </h1>
          <p className="text-lg text-slate-600 mt-1">
            Manage your SolvCommit account, pipeline controls, and preferences.
          </p>
        </div>
      </div>

      {/* Sync Pipeline Pause / Resume */}
      <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-bold text-slate-900">Pipeline Synchronization</h3>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  syncStatus.is_paused
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {syncStatus.is_paused ? "Paused" : "Active"}
              </span>
            </div>
            <p className="text-base text-slate-600 mt-1.5 max-w-xl">
              Temporarily suspend publishing without losing submissions. New submissions received
              from paired extensions will stay safely queued in Kafka until resumed.
            </p>
          </div>

          <button
            onClick={handleToggleSync}
            disabled={isTogglingSync}
            className={`inline-flex items-center space-x-2.5 px-5 py-3 rounded-xl text-base font-semibold transition-all shadow-xs active:scale-[0.99] disabled:opacity-50 ${
              syncStatus.is_paused
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
            }`}
          >
            {syncStatus.is_paused ? (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>{isTogglingSync ? "Resuming..." : "Resume Pipeline"}</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 fill-current" />
                <span>{isTogglingSync ? "Pausing..." : "Pause Pipeline"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Browser Extension Installation & Setup Guide */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Extension Setup Guide</h3>
            <p className="text-base text-slate-600 mt-1">
              Install SolvCommit in Chrome or Firefox to capture your accepted LeetCode submissions.
            </p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveBrowserTab("chrome")}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeBrowserTab === "chrome"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Chrome className="h-3.5 w-3.5" />
              <span>Chrome / Chromium</span>
            </button>
            <button
              onClick={() => setActiveBrowserTab("firefox")}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeBrowserTab === "firefox"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span>Mozilla Firefox</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeBrowserTab === "chrome" ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-start space-x-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold shrink-0">
                  1
                </span>
                <div>
                  <span className="font-semibold text-slate-800">Open Extension Management</span>
                  <p className="text-slate-500 mt-0.5">
                    Navigate to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">chrome://extensions</code> in your Chrome address bar.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold shrink-0">
                  2
                </span>
                <div>
                  <span className="font-semibold text-slate-800">Enable Developer Mode & Load Extension</span>
                  <p className="text-slate-500 mt-0.5">
                    Toggle <strong>Developer mode</strong> in the top-right corner. Click <strong>Load unpacked</strong> and select the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">extension/</code> directory of this repository.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold shrink-0">
                  3
                </span>
                <div>
                  <span className="font-semibold text-slate-800">Pair With Dashboard</span>
                  <p className="text-slate-500 mt-0.5">
                    Click the SolvCommit extension icon in your toolbar, click <strong>Pair Device</strong>, and paste your pairing code from the <em>Devices</em> tab.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="flex items-start space-x-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold shrink-0">
                  1
                </span>
                <div>
                  <span className="font-semibold text-slate-800">Open Firefox Debugging</span>
                  <p className="text-slate-500 mt-0.5">
                    Navigate to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">about:debugging#/runtime/this-firefox</code> in Firefox.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold shrink-0">
                  2
                </span>
                <div>
                  <span className="font-semibold text-slate-800">Load Temporary Extension</span>
                  <p className="text-slate-500 mt-0.5">
                    Click <strong>Load Temporary Add-on...</strong> and choose the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">extension/manifest.json</code> file.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold shrink-0">
                  3
                </span>
                <div>
                  <span className="font-semibold text-slate-800">Pair & Verify</span>
                  <p className="text-slate-500 mt-0.5">
                    Click the puzzle piece icon, pin SolvCommit to your toolbar, and complete pairing with your pairing token.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Account & Security Invariants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Github className="h-4 w-4 text-slate-800" />
            <h3 className="text-sm font-semibold text-slate-900">GitHub Connection</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">User Profile ID</span>
              <span className="font-mono text-slate-800">{user.id.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">GitHub User ID</span>
              <span className="font-mono text-slate-800">{user.github_user_id}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">GitHub App Installation</span>
              <span className="font-mono text-slate-800">#{user.installation_id}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Token Storage</span>
              <span className="text-emerald-700 font-medium">Ephemeral in-memory RS256</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Guarantees & Compliance</h3>
          </div>

          <ul className="space-y-2.5 text-xs text-slate-600">
            <li className="flex items-start space-x-2">
              <span className="text-emerald-600 font-bold shrink-0">✓</span>
              <span><strong>Zero LeetCode Credentials:</strong> SolvCommit never handles or stores your LeetCode password or cookies.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-emerald-600 font-bold shrink-0">✓</span>
              <span><strong>Code Only in Kafka:</strong> Source code is never persisted in PostgreSQL; stored strictly in Kafka with 7-day retention.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-emerald-600 font-bold shrink-0">✓</span>
              <span><strong>Non-destructive Publishing:</strong> Existing files and READMEs are never overwritten or force-pushed.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-rose-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center space-x-2 text-rose-700">
          <ShieldAlert className="h-5 w-5" />
          <h3 className="text-sm font-semibold">Danger Zone</h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
          Permanently delete your SolvCommit account, repository associations, and device session keys.
          Your GitHub repositories and existing commits remain untouched on GitHub.
        </p>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete Account</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/10">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Confirm Account Deletion</h3>
                <p className="text-xs text-slate-500">This action is permanent and cannot be undone</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              All metadata, device pairings, and sync preferences will be immediately and permanently
              removed from SolvCommit.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Type <strong className="text-slate-900 font-mono">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationInput !== "DELETE" || isDeleting}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 active:scale-[0.99] disabled:opacity-40 transition-all shadow-xs"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
