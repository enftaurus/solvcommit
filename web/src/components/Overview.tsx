import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitBranch,
  ExternalLink,
  Laptop,
  ArrowRight,
  Sparkles,
  FolderGit2,
  ListFilter,
  ShieldCheck,
} from "lucide-react";
import { SyncStatus, Repository, SubmissionRow } from "../types";

interface OverviewProps {
  status: SyncStatus | null;
  repo: Repository | null;
  recentSubmissions: SubmissionRow[];
  onOpenRepoSettings: () => void;
  onOpenSubmissions: () => void;
  onOpenPairModal: () => void;
}

export const Overview: React.FC<OverviewProps> = ({
  status,
  repo,
  recentSubmissions,
  onOpenRepoSettings,
  onOpenSubmissions,
  onOpenPairModal,
}) => {
  const publishedCount = status?.published ?? 0;
  const queuedCount = status?.queued ?? 0;
  const processingCount = (status?.processing ?? 0) + (status?.retrying ?? 0);
  const issuesCount = status?.failed ?? 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Dynamic Next Required Action Banner if repo is missing */}
      {!repo && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Setup Incomplete
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-blue-800 font-medium">Step 1 of 2</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                Connect your GitHub repository to enable automatic syncing
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Select or create <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 text-slate-800">leetcode-submissions</code> as your destination.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenRepoSettings}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition active:scale-98"
          >
            <span>Configure Repository</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Browser Extension Pairing Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
            <Laptop className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">
                Browser Extension Sync
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Chrome & Firefox Ready
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Captures accepted submissions inside your active LeetCode tab with zero password custody. (Edge & Safari rolling out soon).
            </p>
          </div>
        </div>

        <button
          onClick={onOpenPairModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-98 shadow-xs"
        >
          <span>Pair New Extension</span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Published */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium text-slate-500">Published</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {publishedCount}
            </span>
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            Committed to GitHub
          </span>
        </div>

        {/* Queued */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium text-slate-500">Queued</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {queuedCount}
            </span>
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            Buffer awaiting commit
          </span>
        </div>

        {/* In-Flight */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium text-slate-500">In-Flight</span>
            <Sparkles className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {processingCount}
            </span>
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            Publishing to repo
          </span>
        </div>

        {/* Issues */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium text-slate-500">Issues</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {issuesCount}
            </span>
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            Requires retry or attention
          </span>
        </div>
      </div>

      {/* 2-Column: Destination Repository + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Destination Repository Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Destination Repository
              </span>
              {repo ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                  Not Set
                </span>
              )}
            </div>

            {repo ? (
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Repository</span>
                  <a
                    href={`https://github.com/${repo.owner}/${repo.name}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-2 text-base font-bold text-slate-900 hover:text-blue-600 transition group"
                  >
                    <span>{repo.owner}/{repo.name}</span>
                    <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                  </a>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <GitBranch className="h-4 w-4 text-slate-400" />
                  <span>Target branch:</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                    {repo.default_branch}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-200/80 space-y-1">
                  <div className="font-semibold text-slate-800">Deterministic Path Format:</div>
                  <code className="text-slate-600 font-mono text-[11px] block">
                    &lt;problem-slug&gt;/solution-&lt;id&gt;.&lt;ext&gt;
                  </code>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <FolderGit2 className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-500">No destination repository selected yet.</p>
                <button
                  onClick={onOpenRepoSettings}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  Configure Repository
                </button>
              </div>
            )}
          </div>

          {repo && (
            <div className="pt-4 border-t border-slate-100 mt-6">
              <button
                onClick={onOpenRepoSettings}
                className="w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1"
              >
                <span>Change Repository Settings</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Recent Submissions Feed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent Submissions
              </span>
              <button
                onClick={onOpenSubmissions}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition inline-flex items-center gap-1"
              >
                <span>View all ({publishedCount})</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {recentSubmissions && recentSubmissions.length > 0 ? (
              <div className="mt-4 divide-y divide-slate-100">
                {recentSubmissions.slice(0, 5).map((sub) => (
                  <div
                    key={sub.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 rounded-xl px-2.5 transition -mx-2.5"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {sub.problem_title || sub.problem_slug}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {sub.language}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        ID: {sub.leetcode_submission_id} • {new Date(sub.received_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          sub.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : sub.status === "queued"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {sub.status === "published" && <CheckCircle2 className="h-3 w-3" />}
                        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      </span>

                      {sub.commit_sha && (
                        <span className="font-mono text-xs text-slate-400" title={sub.commit_sha}>
                          {sub.commit_sha.slice(0, 7)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <ListFilter className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-500">
                  No submissions captured yet. Solve a problem on LeetCode to trigger your first commit!
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-6 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Only accepted verdicts are published
            </span>
            <span className="text-slate-400">Idempotency enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
};
