import React, { useState, useEffect } from "react";
import {
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  FolderGit2,
} from "lucide-react";
import { Repository, GitHubRepoInfo } from "../types";
import { api } from "../api";

interface RepoSettingsProps {
  currentRepo: Repository | null;
  onRepoUpdated: () => void;
}

export const RepoSettings: React.FC<RepoSettingsProps> = ({
  currentRepo,
  onRepoUpdated,
}) => {
  const [availableRepos, setAvailableRepos] = useState<GitHubRepoInfo[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(
    currentRepo ? currentRepo.github_repo_id : null
  );
  const [defaultBranch, setDefaultBranch] = useState<string>(
    currentRepo ? currentRepo.default_branch : "main"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    loadAvailableRepos();
  }, []);

  const loadAvailableRepos = async () => {
    try {
      const repos = await api.listGitHubRepos();
      setAvailableRepos(repos);
      if (!selectedRepoId && repos.length > 0) {
        setSelectedRepoId(repos[0].id);
        setDefaultBranch(repos[0].default_branch || "main");
      }
    } catch (err: any) {
      console.warn("Could not list repos automatically:", err);
    }
  };

  const handleSaveRepo = async () => {
    if (!selectedRepoId) return;
    const repoObj = availableRepos.find((r) => r.id === selectedRepoId);
    if (!repoObj) return;

    setIsLoading(true);
    setVerifyMessage(null);
    try {
      await api.selectRepo({
        github_repo_id: repoObj.id,
        owner: repoObj.owner,
        name: repoObj.name,
        default_branch: defaultBranch.trim() || "main",
      });
      setVerifyMessage({
        success: true,
        text: "Repository successfully updated and verified!",
      });
      onRepoUpdated();
    } catch (err: any) {
      setVerifyMessage({
        success: false,
        text: "Failed to connect repository: " + err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyMessage(null);
    try {
      await api.verifyRepo();
      setVerifyMessage({
        success: true,
        text: "Server verified write and metadata access on repository.",
      });
    } catch (err: any) {
      setVerifyMessage({
        success: false,
        text: "Verification failed: " + err.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fadeIn">
      {/* Current Repo Card */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200">
            <FolderGit2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Destination GitHub Repository
            </h2>
            <p className="text-xs text-zinc-500">
              Where your accepted LeetCode submissions will be committed.
            </p>
          </div>
        </div>

        {currentRepo ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-zinc-50/80 p-4 border border-zinc-200/80">
              <div>
                <div className="text-xs font-medium text-zinc-400">Current Destination</div>
                <div className="text-base font-semibold text-zinc-900 mt-0.5">
                  {currentRepo.owner}/{currentRepo.name}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                  <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Branch: <span className="font-mono text-zinc-800">{currentRepo.default_branch}</span></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-95 transition"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-zinc-600" />
                  <span>{isVerifying ? "Verifying..." : "Verify Access"}</span>
                </button>
                <a
                  href={`https://github.com/${currentRepo.owner}/${currentRepo.name}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-500 hover:text-zinc-800 transition"
                  title="Open on GitHub"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {verifyMessage && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 text-xs border ${
                  verifyMessage.success
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200/70"
                    : "bg-rose-50 text-rose-800 border-rose-200/70"
                }`}
              >
                {verifyMessage.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                )}
                <span>{verifyMessage.text}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-xs text-zinc-500">
            No repository configured yet. Select one from your authorized GitHub App repositories below.
          </div>
        )}
      </div>

      {/* Select / Change Repo Card */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          Select or Switch Destination Repository
        </h3>

        {availableRepos.length > 0 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Authorized Repositories
              </label>
              <select
                value={selectedRepoId || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedRepoId(id);
                  const found = availableRepos.find((r) => r.id === id);
                  if (found) setDefaultBranch(found.default_branch || "main");
                }}
                className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none transition shadow-sm"
              >
                {availableRepos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.owner}/{r.name} {r.private ? "(Private)" : "(Public)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Target Branch
              </label>
              <input
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
                className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none font-mono transition shadow-sm"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveRepo}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isLoading ? "Saving..." : "Save Destination"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-zinc-50 p-4 text-xs text-zinc-500 border border-zinc-200/60">
            <p>
              No repositories detected with the LeetSync GitHub App installed.
            </p>
            <p className="mt-1 text-zinc-400">
              Install the GitHub App on your desired repository in GitHub Settings, then refresh this page.
            </p>
          </div>
        )}
      </div>

      {/* Non-Negotiable Safety Invariant Callout */}
      <div className="rounded-xl border border-zinc-200/60 bg-zinc-50/70 p-4 text-xs text-zinc-600 space-y-1.5">
        <div className="font-semibold text-zinc-800">Publishing Safety Guarantees:</div>
        <ul className="list-disc pl-5 space-y-1 text-zinc-500">
          <li>Never force-pushes or rewrites existing git history.</li>
          <li>Never touches or overwrites your custom repository README.</li>
          <li>Checks target paths by blob SHA to prevent conflicting file overwrites.</li>
        </ul>
      </div>
    </div>
  );
};
