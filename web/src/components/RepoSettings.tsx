import React, { useState, useEffect } from "react";
import {
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  FolderGit2,
  Sparkles,
  RefreshCw,
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
        // Auto-select preferred default repository: leetcode-submissions
        const preferred = repos.find(
          (r) =>
            r.name.toLowerCase() === "leetcode-submissions" ||
            r.name.toLowerCase() === "leetcode_submissions" ||
            r.name.toLowerCase() === "leetcode-solutions"
        );
        const target = preferred || repos[0];
        setSelectedRepoId(target.id);
        setDefaultBranch(target.default_branch || "main");
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

  const [isRefreshingRepos, setIsRefreshingRepos] = useState(false);

  const handleRefreshList = async () => {
    setIsRefreshingRepos(true);
    await loadAvailableRepos();
    setIsRefreshingRepos(false);
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
          <div className="py-4 text-xs text-zinc-500 space-y-3">
            <p>No repository configured yet. Select one from your authorized GitHub App repositories below, or create the default repository.</p>
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
        )}
      </div>

      {/* Step-by-Step GitHub App Permission & Setup Guide */}
      <div className="rounded-xl border border-blue-200/90 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-5 space-y-4 text-xs text-blue-950 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 font-semibold text-sm text-blue-900">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-600 shrink-0" />
            <span>GitHub App Permissions & Setup Guide</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 w-fit">
            <span>Default Repo:</span>
            <code className="font-mono font-semibold">leetcode-submissions</code>
          </span>
        </div>

        <p className="text-blue-900/90 leading-relaxed">
          When allowing SolvCommit access to GitHub, the app requires permission for your destination repository to automatically commit solutions. Follow these 3 steps:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Step 1 */}
          <div className="bg-white/90 p-4 rounded-xl border border-blue-100 shadow-2xs space-y-2.5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">
                  1
                </span>
                <span className="font-semibold text-zinc-900">Create Repository</span>
              </div>
              <p className="text-[11px] text-zinc-600 leading-normal">
                Create a repo named <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 font-semibold">leetcode-submissions</code> on GitHub (Private or Public).
              </p>
            </div>
            <a
              href="https://github.com/new?name=leetcode-submissions&description=LeetCode%20submissions%20synced%20automatically%20by%20SolvCommit&visibility=private"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800 transition"
            >
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Create on GitHub</span>
              <ExternalLink className="h-2.5 w-2.5 text-zinc-400" />
            </a>
          </div>

          {/* Step 2 */}
          <div className="bg-white/90 p-4 rounded-xl border border-blue-100 shadow-2xs space-y-2.5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">
                  2
                </span>
                <span className="font-semibold text-zinc-900">Grant Permission</span>
              </div>
              <p className="text-[11px] text-zinc-600 leading-normal">
                When allowing access on GitHub:
                <br />
                • Choose <strong>"All repositories"</strong> (simplest), <em>OR</em>
                <br />
                • Choose <strong>"Only select repositories"</strong> and explicitly choose <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">leetcode-submissions</code>.
              </p>
            </div>
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 transition"
            >
              <span>GitHub App Settings</span>
              <ExternalLink className="h-2.5 w-2.5 text-zinc-400" />
            </a>
          </div>

          {/* Step 3 */}
          <div className="bg-white/90 p-4 rounded-xl border border-blue-100 shadow-2xs space-y-2.5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">
                  3
                </span>
                <span className="font-semibold text-zinc-900">Save Destination</span>
              </div>
              <p className="text-[11px] text-zinc-600 leading-normal">
                Select <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">leetcode-submissions</code> below and click <strong>Save Destination</strong>.
              </p>
            </div>
            <button
              onClick={handleRefreshList}
              disabled={isRefreshingRepos}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-[11px] font-medium text-blue-800 hover:bg-blue-100/80 transition"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshingRepos ? "animate-spin text-blue-500" : "text-blue-600"}`} />
              <span>Refresh Repository List</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-blue-200/60 flex items-start sm:items-center gap-2 text-[11px] text-blue-900">
          <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>Note on permissions:</strong> If you created the repository after installing SolvCommit, GitHub does not grant access automatically unless "All repositories" is selected. Add it anytime at{" "}
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noreferrer"
              className="underline font-semibold hover:text-blue-950 inline-flex items-center gap-0.5"
            >
              <span>github.com/settings/installations</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            , then click <strong>Refresh</strong>.
          </span>
        </div>
      </div>

      {/* Select / Change Repo Card */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">
            Select Destination Repository
          </h3>
          <button
            onClick={loadAvailableRepos}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
            title="Reload repository list from GitHub"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin text-zinc-400" : "text-zinc-600"}`} />
            <span>Reload Repositories</span>
          </button>
        </div>

        {availableRepos.length > 0 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Authorized Repositories (Permitted by GitHub App)
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
                {availableRepos.map((r) => {
                  const isDefault =
                    r.name.toLowerCase() === "leetcode-submissions" ||
                    r.name.toLowerCase() === "leetcode_submissions" ||
                    r.name.toLowerCase() === "leetcode-solutions";
                  return (
                    <option key={r.id} value={r.id}>
                      {r.owner}/{r.name} {isDefault ? "★ (Recommended Default)" : ""} {r.private ? "(Private)" : "(Public)"}
                    </option>
                  );
                })}
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

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={handleSaveRepo}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isLoading ? "Saving..." : "Save Destination"}</span>
              </button>

              <a
                href="https://github.com/new?name=leetcode-submissions&description=LeetCode%20submissions%20synced%20automatically%20by%20SolvCommit&visibility=private"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Create 'leetcode-submissions' on GitHub</span>
                <ExternalLink className="h-3 w-3 text-zinc-400" />
              </a>

              <button
                onClick={handleRefreshList}
                disabled={isRefreshingRepos}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingRepos ? "animate-spin text-zinc-400" : "text-zinc-600"}`} />
                <span>I created it, refresh list</span>
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 pt-1">
              Choose "All repositories" when installing the app, or add the new repo to the installation at{" "}
              <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="underline hover:text-zinc-600">
                github.com/settings/installations
              </a>
              , otherwise it will not appear in the list.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-zinc-50 p-5 text-xs text-zinc-600 border border-zinc-200/60 space-y-3">
            <div className="font-medium text-zinc-800">No destination repository found in authorized list.</div>
            <p className="text-zinc-500 leading-relaxed">
              Create the default <code className="font-mono font-semibold bg-zinc-200/80 px-1 py-0.5 rounded text-zinc-800">leetcode-submissions</code> repository on GitHub, grant the SolvCommit GitHub App permission to access it, and refresh this list.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <a
                href="https://github.com/new?name=leetcode-submissions&description=LeetCode%20submissions%20synced%20automatically%20by%20SolvCommit&visibility=private"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Create 'leetcode-submissions' on GitHub</span>
                <ExternalLink className="h-3 w-3 text-zinc-300" />
              </a>
              <button
                onClick={handleRefreshList}
                disabled={isRefreshingRepos}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingRepos ? "animate-spin text-zinc-400" : "text-zinc-600"}`} />
                <span>I created it, refresh list</span>
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 pt-1">
              Choose "All repositories" when installing the app, or add the new repo to the installation at{" "}
              <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="underline hover:text-zinc-600">
                github.com/settings/installations
              </a>
              , otherwise it will not appear in the list.
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
