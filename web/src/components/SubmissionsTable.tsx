import React, { useState } from "react";
import { Search, ExternalLink, RotateCw } from "lucide-react";
import { SubmissionRow, Repository } from "../types";
import { api } from "../api";

interface SubmissionsTableProps {
  submissions: SubmissionRow[];
  total: number;
  repo: Repository | null;
  onRefresh: () => void;
}

export const SubmissionsTable: React.FC<SubmissionsTableProps> = ({
  submissions,
  total,
  repo,
  onRefresh,
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await api.retrySubmission(id);
      onRefresh();
    } catch (err: any) {
      alert("Failed to retry submission: " + err.message);
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
    <div className="space-y-4 animate-fadeIn">
      {/* Search and Filter Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search problems, slugs or IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none transition shadow-sm"
          />
        </div>

        {/* Filter Pills and Total Count */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
            {filtered.length} of {total} submissions
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
            {["all", "published", "queued", "failed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  filter === f
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-5 py-3 font-semibold">Problem</th>
              <th className="px-5 py-3 font-semibold">Language</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Submission ID</th>
              <th className="px-5 py-3 font-semibold">Synced Path</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length > 0 ? (
              filtered.map((sub) => (
                <tr key={sub.id} className="hover:bg-zinc-50/60 transition-colors">
                  {/* Problem Title & Slug */}
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-zinc-900">{sub.problem_title}</div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{sub.problem_slug}</div>
                  </td>

                  {/* Language */}
                  <td className="px-5 py-3.5">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700 border border-zinc-200">
                      {sub.language}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                        sub.status === "published"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : sub.status === "queued"
                          ? "bg-amber-50 text-amber-700 border-amber-200/60"
                          : sub.status === "processing"
                          ? "bg-blue-50 text-blue-700 border-blue-200/60"
                          : sub.status === "retrying"
                          ? "bg-orange-50 text-orange-700 border-orange-200/60"
                          : "bg-rose-50 text-rose-700 border-rose-200/60"
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
                      {sub.status}
                    </span>
                  </td>

                  {/* ID & Date */}
                  <td className="px-5 py-3.5 font-mono text-[11px] text-zinc-600">
                    <div>{sub.leetcode_submission_id}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {new Date(sub.received_at).toLocaleDateString()}
                    </div>
                  </td>

                  {/* Path / Commit Link */}
                  <td className="px-5 py-3.5">
                    {sub.github_path && repo ? (
                      <a
                        href={`https://github.com/${repo.owner}/${repo.name}/blob/${repo.default_branch}/${sub.github_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-700 hover:text-blue-600 transition"
                      >
                        <span className="truncate max-w-[140px]">{sub.github_path}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400" />
                      </a>
                    ) : (
                      <span className="text-zinc-400 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Action (Retry for failed/expired) */}
                  <td className="px-5 py-3.5 text-right">
                    {(sub.status === "failed" || sub.status === "expired" || sub.status === "retrying") ? (
                      <button
                        onClick={() => handleRetry(sub.id)}
                        disabled={retryingId === sub.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-95 transition"
                      >
                        <RotateCw
                          className={`h-3 w-3 ${
                            retryingId === sub.id ? "animate-spin text-zinc-900" : ""
                          }`}
                        />
                        <span>Retry</span>
                      </button>
                    ) : (
                      <span className="text-zinc-300 text-[11px]">Active</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-400">
                  No submissions match the current query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
