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
    <div className="space-y-6 max-w-5xl animate-fadeIn">
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search problems, slugs or IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition shadow-2xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl border border-slate-200 bg-white shadow-2xs overflow-x-auto">
          {["all", "published", "queued", "failed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
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
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider text-xs font-semibold">
            <tr>
              <th className="px-6 py-3.5">Problem</th>
              <th className="px-6 py-3.5">Language</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5">Submission ID</th>
              <th className="px-6 py-3.5">GitHub Path</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Problem Title & Slug */}
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 text-sm">
                      {sub.problem_title || sub.problem_slug}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {sub.problem_slug}
                    </div>
                  </td>

                  {/* Language */}
                  <td className="px-6 py-4">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 border border-slate-200">
                      {sub.language}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${
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
                        className={`h-1.5 w-1.5 rounded-full ${
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
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">
                    <div>#{sub.leetcode_submission_id}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(sub.received_at).toLocaleDateString()}
                    </div>
                  </td>

                  {/* GitHub Path / Commit Link */}
                  <td className="px-6 py-4">
                    {sub.github_path && repo ? (
                      <a
                        href={`https://github.com/${repo.owner}/${repo.name}/blob/${repo.default_branch}/${sub.github_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-slate-700 hover:text-blue-600 transition"
                      >
                        <span className="truncate max-w-[150px]">{sub.github_path}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Action (Retry for failed/expired) */}
                  <td className="px-6 py-4 text-right">
                    {sub.status === "failed" || sub.status === "expired" ? (
                      <button
                        onClick={() => handleRetry(sub.id)}
                        disabled={retryingId === sub.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
                      >
                        <RotateCw
                          className={`h-3 w-3 ${retryingId === sub.id ? "animate-spin" : ""}`}
                        />
                        <span>Retry</span>
                      </button>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
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
