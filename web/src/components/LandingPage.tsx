import React, { useState } from "react";
import {
  Github,
  ArrowRight,
  ShieldCheck,
  FolderGit2,
  Lock,
  Chrome,
  Flame,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import { api } from "../api";

interface LandingPageProps {
  onEnterDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterDemo }) => {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const res = await api.getLoginURL();
      if (res && res.url) {
        window.location.href = res.url;
      } else {
        window.location.href = "/api/v1/auth/github/start";
      }
    } catch {
      window.location.href = "/api/v1/auth/github/start";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-base tracking-tight text-slate-900">LeetSync</span>
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onEnterDemo}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Explore Demo</span>
            </button>
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="inline-flex items-center space-x-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition-all shadow-xs"
            >
              <Github className="h-3.5 w-3.5" />
              <span>{loading ? "Connecting..." : "Sign in with GitHub"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs text-xs font-medium text-slate-700">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cross-Browser Manifest V3 · Chrome & Firefox</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-950 leading-[1.15]">
            Publish every accepted LeetCode submission to GitHub.
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
            Zero LeetCode credentials stored. Source code buffered strictly in Kafka with 7-day
            retention. Idempotent git-tree publishing that never overwrites existing work.
          </p>

          {/* CTA Group */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onEnterDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition-all shadow-sm"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Explore Interactive Demo</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 transition-colors shadow-xs"
            >
              <Github className="h-4 w-4" />
              <span>{loading ? "Redirecting..." : "Connect GitHub App"}</span>
            </button>
          </div>

          {/* Supported Browsers Pill */}
          <div className="pt-4 flex items-center justify-center space-x-6 text-xs text-slate-500">
            <span className="flex items-center space-x-1.5">
              <Chrome className="h-4 w-4 text-slate-700" />
              <span>Google Chrome & Chromium</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center space-x-1.5">
              <Flame className="h-4 w-4 text-orange-500" />
              <span>Mozilla Firefox</span>
            </span>
          </div>
        </div>

        {/* Visual Preview / Directory Tree Card */}
        <div className="mt-16 bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden max-w-4xl mx-auto">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 rounded-full bg-slate-300" />
              <span className="h-3 w-3 rounded-full bg-slate-300" />
              <span className="h-3 w-3 rounded-full bg-slate-300" />
              <span className="ml-2 font-mono text-xs text-slate-500">
                github.com/user/leetcode-solutions
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">git branch: main</span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
            <div className="space-y-3 font-mono text-xs">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Deterministic Repository Structure
              </div>
              <div className="rounded-xl bg-slate-900 p-4 text-slate-200 space-y-1.5">
                <div className="text-emerald-400">leetcode-solutions/</div>
                <div className="pl-4 text-slate-300">├── README.md</div>
                <div className="pl-4 text-slate-400">└── problems/</div>
                <div className="pl-8 text-slate-300">├── two-sum/</div>
                <div className="pl-12 text-blue-400">├── solution.py</div>
                <div className="pl-12 text-slate-400">└── README.md</div>
                <div className="pl-8 text-slate-300">├── median-of-two-sorted-arrays/</div>
                <div className="pl-12 text-amber-400">├── solution.go</div>
                <div className="pl-12 text-slate-400">└── README.md</div>
              </div>
            </div>

            <div className="space-y-3 flex flex-col justify-center">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Publishing Guarantees
              </div>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Non-destructive commits:</strong> Existing READMEs and solution files
                    are strictly preserved. Git blob SHAs prevent duplicate commits.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Multi-language support:</strong> Python, Go, C++, TypeScript, Rust,
                    Java, C#, Swift, and SQL are automatically organized into language extensions.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Serialized Git commits:</strong> Per-repo mutex queues protect against
                    GitHub Git commit conflicts and API rate limits.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Non-Negotiable Architecture Pillars */}
        <div id="architecture" className="mt-24 space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Engineered for Privacy & Zero Credential Custody
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Every design decision prioritizes privacy, security, and idempotence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Zero LeetCode Credentials</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The server never logs into LeetCode. Your browser extension reads submissions
                directly inside your active authenticated tab and pushes the accepted result.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Source Code Only in Kafka</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                PostgreSQL holds thin metadata and pipeline state only. Problem source code lives
                strictly in Kafka messages with 7-day retention and is purged once committed.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Token Rotation & Reuse Breach Protection</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Extension refresh tokens are stored only as SHA-256 hashes and rotate on every call.
                Attempted token reuse automatically revokes the entire token family.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800">LeetSync</span>
            <span>—</span>
            <span>Accepted submissions to GitHub automatically.</span>
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/enftaurus/solvcommit"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-900 transition-colors flex items-center space-x-1"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
            <span>•</span>
            <span>Phase 5 (Dashboard)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
