import React, { useState, useEffect, useMemo } from "react";
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
  Search,
  ChevronDown,
  ChevronUp,
  Lock,
  Globe,
  ArrowRight,
  HelpCircle,
  Check,
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
  const [isChangingRepo, setIsChangingRepo] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingRepos, setIsRefreshingRepos] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    loadAvailableRepos();
  }, []);

  useEffect(() => {
    if (currentRepo) {
      setSelectedRepoId(currentRepo.github_repo_id);
      setDefaultBranch(currentRepo.default_branch || "main");
    }
  }, [currentRepo]);

  const loadAvailableRepos = async () => {
    try {
      setIsRefreshingRepos(true);
      const repos = await api.listGitHubRepos();
      setAvailableRepos(repos);
      if (!selectedRepoId && repos.length > 0) {
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
    } finally {
      setIsRefreshingRepos(false);
    }
  };

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return availableRepos;
    const q = searchQuery.toLowerCase();
    return availableRepos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q)
    );
  }, [availableRepos, searchQuery]);

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
        text: "Destination repository successfully saved and verified!",
      });
      setIsChangingRepo(false);
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
        text: "Repository connection verified. SolvCommit has write access.",
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

  const getStatusBadge = () => {
    if (currentRepo && currentRepo.status === "active") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Connected
        </span>
      );
    }
    if (availableRepos.length === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Setup required
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        Setup required
      </span>
    );
  };

  const isConfigured = Boolean(currentRepo && !isChangingRepo);

  return (
    <div className="space-y-8 max-w-4xl animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Repository
          </h1>
          <p className="text-lg text-slate-600 mt-1">
            Choose where your accepted solutions are saved.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
        </div>
      </div>

      {/* Global Status Message */}
      {verifyMessage && (
        <div
          className={`flex items-start gap-3.5 p-5 rounded-2xl text-base border transition-all ${
            verifyMessage.success
              ? "bg-emerald-50/80 text-emerald-900 border-emerald-200"
              : "bg-rose-50/80 text-rose-900 border-rose-200"
          }`}
        >
          {verifyMessage.success ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-6 w-6 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-semibold">{verifyMessage.text}</span>
          </div>
          <button
            onClick={() => setVerifyMessage(null)}
            className="text-sm text-slate-500 hover:text-slate-800 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary State 1: Connected Repository Card */}
      {isConfigured && currentRepo && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-9 space-y-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-5">
              <div className="h-14 w-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <FolderGit2 className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {currentRepo.owner}/{currentRepo.name}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                    Private
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-base text-slate-600">
                  <span className="flex items-center gap-2">
                    <GitBranch className="h-4.5 w-4.5 text-slate-400" />
                    Branch: <strong className="font-mono text-slate-900 font-bold">{currentRepo.default_branch}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <Check className="h-4.5 w-4.5 text-emerald-500" />
                    Write access active
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-800 hover:bg-slate-50 transition active:scale-98 disabled:opacity-50 shadow-xs"
              >
                <ShieldCheck className={`h-4.5 w-4.5 text-slate-500 ${isVerifying ? "animate-spin" : ""}`} />
                <span>{isVerifying ? "Verifying..." : "Verify Access"}</span>
              </button>

              <a
                href={`https://github.com/${currentRepo.owner}/${currentRepo.name}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-800 hover:bg-slate-50 transition active:scale-98 shadow-xs"
              >
                <span>View on GitHub</span>
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </a>

              <button
                onClick={() => setIsChangingRepo(true)}
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-slate-900 text-white text-base font-semibold hover:bg-slate-800 transition active:scale-98 shadow-sm"
              >
                <span>Change repository</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base text-slate-700 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-slate-500 font-semibold text-sm block mb-1.5">Target Directory Format</span>
              <code className="font-mono text-sm bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-900 font-bold">
                &lt;problem-slug&gt;/solution-&lt;id&gt;.&lt;ext&gt;
              </code>
            </div>
            <div>
              <span className="text-slate-500 font-semibold text-sm block mb-1.5">Automatic Documentation</span>
              <span className="text-slate-700 text-sm font-medium">Updates repository README with a live solutions index badge.</span>
            </div>
          </div>
        </div>
      )}

      {/* Primary State 2: First-Time Setup (When no repo is configured) */}
      {!currentRepo && !isChangingRepo && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-9 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">
              Connect Your Destination Repository
            </h2>
            <p className="text-lg text-slate-600">
              Complete these 3 simple steps to start committing accepted solutions automatically.
            </p>
          </div>

          {/* 3-Step Setup Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center">
                    1
                  </span>
                  <h3 className="font-bold text-slate-900 text-lg">Create Repository</h3>
                </div>
                <p className="text-base text-slate-600 leading-relaxed">
                  Create a new repository named <strong className="text-slate-900">leetcode-submissions</strong> on GitHub (Public or Private).
                </p>
              </div>
              <a
                href="https://github.com/new?name=leetcode-submissions&description=LeetCode%20submissions%20synced%20automatically%20by%20SolvCommit&visibility=private"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-base font-semibold hover:bg-slate-800 transition active:scale-98 shadow-sm"
              >
                <Sparkles className="h-4.5 w-4.5 text-amber-400" />
                <span>Create on GitHub</span>
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </a>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center">
                    2
                  </span>
                  <h3 className="font-bold text-slate-900 text-lg">Grant Access</h3>
                </div>
                <p className="text-base text-slate-600 leading-relaxed">
                  In GitHub App settings, choose <strong>"All repositories"</strong> or select <strong className="text-slate-900">leetcode-submissions</strong>.
                </p>
              </div>
              <a
                href="https://github.com/settings/installations"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-800 hover:bg-slate-50 transition active:scale-98 shadow-xs"
              >
                <span>GitHub App Settings</span>
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </a>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center">
                    3
                  </span>
                  <h3 className="font-bold text-slate-900 text-lg">Select & Save</h3>
                </div>
                <p className="text-base text-slate-600 leading-relaxed">
                  Select <strong className="text-slate-900">leetcode-submissions</strong> from the authorized list below and save.
                </p>
              </div>
              <button
                onClick={() => setIsChangingRepo(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white text-base font-semibold hover:bg-blue-500 transition active:scale-98 shadow-sm"
              >
                <span>Select Repository</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Focused Repository Selection Interface (When Change Repository is clicked or First Setup) */}
      {(isChangingRepo || !currentRepo) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-9 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {currentRepo ? "Switch Destination Repository" : "Select Destination Repository"}
              </h2>
              <p className="text-base text-slate-600 mt-0.5">
                Select from repositories authorized through your GitHub App installation.
              </p>
            </div>
            {currentRepo && (
              <button
                onClick={() => setIsChangingRepo(false)}
                className="text-base font-semibold text-slate-600 hover:text-slate-900 transition"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-5">
            {/* Search and Refresh bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
                />
              </div>

              <button
                onClick={loadAvailableRepos}
                disabled={isRefreshingRepos}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-800 hover:bg-slate-50 transition active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className={`h-4.5 w-4.5 text-slate-500 ${isRefreshingRepos ? "animate-spin" : ""}`} />
                <span>{isRefreshingRepos ? "Refreshing..." : "Refresh List"}</span>
              </button>
            </div>

            {/* Repositories List */}
            {filteredRepos.length > 0 ? (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {filteredRepos.map((r) => {
                  const isSelected = selectedRepoId === r.id;
                  const isRecommended =
                    r.name.toLowerCase() === "leetcode-submissions" ||
                    r.name.toLowerCase() === "leetcode_submissions" ||
                    r.name.toLowerCase() === "leetcode-solutions";

                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setSelectedRepoId(r.id);
                        setDefaultBranch(r.default_branch || "main");
                      }}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <FolderGit2 className={`h-6 w-6 ${isSelected ? "text-slate-900" : "text-slate-400"}`} />
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-base font-bold text-slate-900">
                              {r.owner}/{r.name}
                            </span>
                            {isRecommended && (
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                Recommended
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-slate-500">
                            Default branch: {r.default_branch || "main"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          {r.private ? (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Private
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Globe className="h-3 w-3" /> Public
                            </span>
                          )}
                        </span>
                        <div
                          className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3">
                <FolderGit2 className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-600">
                  {searchQuery
                    ? `No repositories matching "${searchQuery}"`
                    : "No authorized repositories found."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href="https://github.com/new?name=leetcode-submissions&description=LeetCode%20submissions%20synced%20automatically%20by%20SolvCommit&visibility=private"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Create 'leetcode-submissions'</span>
                  </a>
                  <a
                    href="https://github.com/settings/installations"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span>Add Permissions in GitHub</span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                </div>
              </div>
            )}

            {/* Target Branch Input */}
            <div className="pt-2">
              <label className="block text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
                Target Branch
              </label>
              <input
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
                className="w-full max-w-sm px-4 py-3 rounded-xl border border-slate-200 text-base font-mono text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
              />
            </div>

            {/* Save Buttons */}
            <div className="pt-5 flex items-center gap-3.5 border-t border-slate-100">
              <button
                onClick={handleSaveRepo}
                disabled={isLoading || !selectedRepoId}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-slate-900 text-white text-base font-semibold hover:bg-slate-800 transition active:scale-98 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-5 w-5" />
                <span>{isLoading ? "Saving..." : "Save Repository"}</span>
              </button>

              {currentRepo && (
                <button
                  onClick={() => setIsChangingRepo(false)}
                  className="px-5 py-3.5 text-base font-semibold text-slate-600 hover:text-slate-900 transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Advanced Information: How Repository Access Works */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <button
          onClick={() => setIsHelpOpen(!isHelpOpen)}
          className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-50/50 transition"
        >
          <div className="flex items-center gap-4">
            <HelpCircle className="h-6 w-6 text-slate-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                How repository access and publishing work
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Permissions, commit safety, branch handling, and file integrity guarantees.
              </p>
            </div>
          </div>
          {isHelpOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>

        {isHelpOpen && (
          <div className="p-6 pt-2 border-t border-slate-100 bg-slate-50/40 text-sm text-slate-600 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Zero Force Pushing
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  SolvCommit never force-pushes or modifies historical commits. All changes are committed forward cleanly to the designated branch.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Sha256 Collision Prevention
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Before publishing, the system validates the repository path and content hash to prevent accidental file overwrites.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Scoped Permissions
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Access is governed by your GitHub App installation. You can choose "Only select repositories" on GitHub anytime to restrict access strictly to `leetcode-submissions`.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Complete Data Ownership
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You retain 100% intellectual property of your code. SolvCommit acts purely as an automated pipeline from your browser tab to your repository.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
