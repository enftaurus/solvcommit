import React, { useState } from "react";
import { Search, ExternalLink, RotateCw, ListFilter } from "lucide-react";
import { SubmissionRow, Repository } from "../types";
import { api } from "../api";

interface SubmissionsTableProps {
  submissions: SubmissionRow[];
  total: number;
  repo?: Repository | null;
  loading?: boolean;
  onRefresh: () => void;
  onNotify?: (msg: string, type: "success" | "error") => void;
}

export const SubmissionsTable: React.FC<SubmissionsTableProps> = ({
  submissions,
  total,
  repo,
  loading: _loading = false,
  onRefresh,
  onNotify,
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await api.retrySubmission(id);
      if (onNotify) {
        onNotify("Retry triggered successfully", "success");
      }
      onRefresh();
    } catch (err: any) {
      if (onNotify) {
        onNotify("Failed to retry submission: " + err.message, "error");
      } else {
        alert("Failed to retry submission: " + err.message);
      }
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = submissions.filter((sub) => {
    const matchesSearch =
      sub.problem_title.toLowerCase().includes(search.toLowerCase()) ||
      sub.problem_slug.toLowerCase().includes(search.toLowerCase()) ||
      String(sub.leetcode_submission_id).includes(search);
    if (!matchesSearch) return false;
    if (filter === "all") return true;
    return sub.status === filter;
  });

  return (
    <div className="space-y-6 w-full animate-fadeIn">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Submissions
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Real-time synchronization history for accepted LeetCode solutions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
            {total} Total Synced
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search problems, slugs or IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition shadow-2xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 bg-white shadow-2xs overflow-x-auto">
          {["all", "published", "queued", "failed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                filter === f
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Main Submissions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-base">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600 uppercase tracking-wider text-xs font-bold">
            <tr>
              <th className="px-6 py-4">Problem</th>
              <th className="px-6 py-4">Language</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Submission ID</th>
              <th className="px-6 py-4">GitHub Path</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Problem Title & Slug */}
                  <td className="px-6 py-4.5">
                    <div className="font-bold text-slate-900 text-base">
                      {sub.problem_title || sub.problem_slug}
                    </div>
                    <div className="text-sm text-slate-500 font-mono mt-0.5">
                      {sub.problem_slug}
                    </div>
                  </td>

                  {/* Language */}
                  <td className="px-6 py-4.5">
                    <span className="rounded-lg bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-800 border border-slate-200">
                      {sub.language}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold border ${
                        sub.status === "published"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : sub.status === "queued"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : sub.status === "processing"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : sub.status === "retrying"
                          ? "bg-orange-50 text-orange-700 border-orange-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          sub.status === "published"
                            ? "bg-emerald-500"
                            : sub.status === "queued"
                            ? "bg-amber-500"
                            : sub.status === "processing"
                            ? "bg-blue-500 animate-spin"
                            : "bg-rose-500"
                        }`}
                      />
                      {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                  </td>

                  {/* Submission ID & Date */}
                  <td className="px-6 py-4.5 font-mono text-sm text-slate-700">
                    <div className="font-semibold">#{sub.leetcode_submission_id}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(sub.received_at).toLocaleDateString()}
                    </div>
                  </td>

                  {/* GitHub Path / Commit Link */}
                  <td className="px-6 py-4.5">
                    {sub.github_path && repo ? (
                      <a
                        href={`https://github.com/${repo.owner}/${repo.name}/blob/${repo.default_branch}/${sub.github_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-sm text-slate-800 font-medium hover:text-blue-600 transition"
                      >
                        <span className="truncate max-w-[200px]">{sub.github_path}</span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </td>

                  {/* Action (Retry for failed/expired) */}
                  <td className="px-6 py-4.5 text-right">
                    {sub.status === "failed" || sub.status === "expired" ? (
                      <button
                        onClick={() => handleRetry(sub.id)}
                        disabled={retryingId === sub.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
                      >
                        <RotateCw
                          className={`h-4 w-4 ${retryingId === sub.id ? "animate-spin" : ""}`}
                        />
                        <span>Retry</span>
                      </button>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <div className="max-w-xs mx-auto space-y-2">
                    <ListFilter className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-medium">No matching submissions</p>
                    <p className="text-xs text-slate-400">
                      {search ? "Try refining your search keyword." : "Submissions will appear here when you solve problems on LeetCode."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
