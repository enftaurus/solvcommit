import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitBranch,
  ExternalLink,
  Laptop,
  ArrowRight,
  Flame,
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
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner: Browser Extensions Support Notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-zinc-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 border border-zinc-200">
            <Laptop className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">
                Extension Connected & Ready
              </h2>
              <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 border border-zinc-200">
                Chrome & Firefox
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Captures accepted submissions inside your active browser session with zero LeetCode password custody.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenPairModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 transition active:scale-95"
          >
            <span>Pair Extension</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Published */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-zinc-300 transition">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium text-zinc-500">Published</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold tracking-tight text-zinc-950 font-mono">
              {status?.published ?? 0}
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-zinc-400">
            Successfully committed
          </span>
        </div>

        {/* Queued */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-zinc-300 transition">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium text-zinc-500">Queued</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold tracking-tight text-zinc-950 font-mono">
              {status?.queued ?? 0}
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-zinc-400">
            In Kafka buffer
          </span>
        </div>

        {/* Processing / In-Flight */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-zinc-300 transition">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium text-zinc-500">In-Flight</span>
            <Flame className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold tracking-tight text-zinc-950 font-mono">
              {(status?.processing ?? 0) + (status?.retrying ?? 0)}
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-zinc-400">
            Publishing to GitHub
          </span>
        </div>

        {/* Failed / Conflicts */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-zinc-300 transition">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium text-zinc-500">Issues</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold tracking-tight text-zinc-950 font-mono">
              {status?.failed ?? 0}
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-zinc-400">
            Conflicts or errors
          </span>
        </div>
      </div>

      {/* 2-Column: Destination Repository + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Destination Repository Card */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Destination Repository
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200/50">
                Connected
              </span>
            </div>

            {repo ? (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs text-zinc-400">Repository</div>
                  <a
                    href={`https://github.com/${repo.owner}/${repo.name}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-1.5 text-base font-semibold text-zinc-900 hover:text-blue-600 transition"
                  >
                    <span>{repo.owner}/{repo.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                  </a>
                </div>

                <div className="flex items-center gap-2 pt-1 text-xs text-zinc-600">
                  <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Target branch:</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-800">
                    {repo.default_branch}
                  </span>
                </div>

                <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 border border-zinc-100">
                  <span className="font-medium text-zinc-700">Folder structure: </span>
                  <code className="text-zinc-600 font-mono text-[11px]">&lt;problem-slug&gt;/submission-&lt;id&gt;.&lt;ext&gt;</code>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-center py-6">
                <p className="text-xs text-zinc-500">No destination repository selected yet.</p>
                <button
                  onClick={onOpenRepoSettings}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition"
                >
                  Configure Repository
                </button>
              </div>
            )}
          </div>

          {repo && (
            <div className="pt-5 border-t border-zinc-100 mt-6">
              <button
                onClick={onOpenRepoSettings}
                className="w-full text-center text-xs font-medium text-zinc-600 hover:text-zinc-900 transition"
              >
                Change Repository Settings →
              </button>
            </div>
          )}
        </div>

        {/* Recent Submissions Feed */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Recent Submissions
              </span>
              <button
                onClick={onOpenSubmissions}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 transition"
              >
                View all ({status?.total ?? 0})
              </button>
            </div>

            {recentSubmissions && recentSubmissions.length > 0 ? (
              <div className="divide-y divide-zinc-100 mt-2">
                {recentSubmissions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-600 border border-zinc-200">
                        {sub.language}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">
                          {sub.problem_title}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          ID: {sub.leetcode_submission_id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          sub.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                            : sub.status === "queued"
                            ? "bg-amber-50 text-amber-700 border-amber-200/70"
                            : sub.status === "processing"
                            ? "bg-blue-50 text-blue-700 border-blue-200/70"
                            : "bg-rose-50 text-rose-700 border-rose-200/70"
                        }`}
                      >
                        {sub.status}
                      </span>
                      {sub.commit_sha && repo && (
                        <a
                          href={`https://github.com/${repo.owner}/${repo.name}/commit/${sub.commit_sha}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-400 hover:text-zinc-700 transition"
                          title="View Git Commit"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-xs text-zinc-400">
                  No submissions captured yet. Solve a problem on LeetCode to see it synced automatically!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
