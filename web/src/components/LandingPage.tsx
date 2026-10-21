import React, { useState } from "react";
import {
  Github,
  ArrowRight,
  ShieldCheck,
  FolderGit2,
  Code2,
  CheckCircle2,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "../api";
import { Footer } from "./Footer";

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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-200 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shadow-xs">
              <img
                src="/logo.png"
                alt="SolvCommit"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex items-baseline space-x-2.5">
              <span className="font-bold text-2xl tracking-tight text-slate-900">
                SolvCommit
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={onEnterDemo}
              className="inline-flex items-center space-x-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 transition active:scale-98"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Explore Demo</span>
            </button>
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="inline-flex items-center space-x-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 active:scale-98 transition shadow-sm disabled:opacity-50"
            >
              <Github className="h-4.5 w-4.5" />
              <span>{loading ? "Connecting..." : "Sign in with GitHub"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-16 pb-24 space-y-20">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2.5 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-2xs text-sm font-semibold text-slate-700">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Chrome & Firefox extensions supported • Edge & Safari rolling out soon</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-950 leading-[1.1]">
            Your accepted solutions. Automatically on GitHub.
          </h1>

          {/* Subheading */}
          <p className="text-xl sm:text-2xl text-slate-600 leading-relaxed max-w-3xl mx-auto font-normal">
            Connect your GitHub repository and let SolvCommit organize your accepted LeetCode solutions automatically.
          </p>

          {/* CTA Group */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-3 rounded-xl bg-slate-900 px-8 py-4 text-lg font-semibold text-white hover:bg-slate-800 active:scale-98 transition shadow-sm disabled:opacity-50"
            >
              <Github className="h-5 w-5" />
              <span>{loading ? "Connecting..." : "Get started with GitHub"}</span>
              <ArrowRight className="h-4.5 w-4.5" />
            </button>

            <button
              onClick={onEnterDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 rounded-xl border border-slate-300/90 bg-white px-8 py-4 text-lg font-semibold text-slate-800 hover:bg-slate-50 active:scale-98 transition shadow-2xs"
            >
              <Sparkles className="h-4.5 w-4.5 text-amber-500" />
              <span>Explore demo</span>
            </button>
          </div>
        </div>

        {/* Product Preview Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden max-w-5xl mx-auto">
          {/* Mock Window Top Bar */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 font-mono text-xs text-slate-500 font-medium">
                github.com/developer/leetcode-submissions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Synced to GitHub</span>
              </span>
            </div>
          </div>

          {/* Interactive Preview Body */}
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Mascot Showcase Column */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gradient-to-b from-blue-50/50 to-indigo-50/30 border border-blue-100">
              <div className="h-32 w-32 rounded-2xl overflow-hidden border border-slate-800/10 shadow-md">
                <img
                  src="/logo.png"
                  alt="SolvCommit Mascot"
                  className="h-full w-full object-cover"
                />
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-4">
                Automated Solution Sync
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Zero manual copying. Keeps your GitHub commit graph active.
              </p>
            </div>

            {/* Mock Repository Activity Feed */}
            <div className="md:col-span-2 space-y-3 font-mono text-xs">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] font-sans">
                Recent Synced Solutions
              </div>

              {/* Solution 1 */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/60 transition shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    AC
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 font-sans text-sm">
                      1. Two Sum
                    </div>
                    <div className="text-[11px] text-slate-400">
                      two-sum/solution-2138016677.py
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                    Python3
                  </span>
                  <span className="text-slate-400 text-[11px]">2m ago</span>
                </div>
              </div>

              {/* Solution 2 */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/60 transition shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    AC
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 font-sans text-sm">
                      146. LRU Cache
                    </div>
                    <div className="text-[11px] text-slate-400">
                      lru-cache/solution-2138016682.go
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-semibold">
                    Go
                  </span>
                  <span className="text-slate-400 text-[11px]">18m ago</span>
                </div>
              </div>

              {/* Solution 3 */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/60 transition shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    AC
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 font-sans text-sm">
                      42. Trapping Rain Water
                    </div>
                    <div className="text-[11px] text-slate-400">
                      trapping-rain-water/solution-2138016690.cpp
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-xs font-semibold">
                    C++
                  </span>
                  <span className="text-slate-400 text-[11px]">1h ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Section (User-Facing Benefits) */}
        <div className="space-y-10 max-w-7xl w-full mx-auto pt-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Built for seamless developer workflows
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              Focus on solving algorithms while SolvCommit organizes your repository in the background.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Benefit 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Automatic Syncing</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Accepted submissions trigger commits immediately from your active tab without clicking buttons.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FolderGit2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Organized Codebase</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Deterministic folder structures with problem slugs, language extensions, and solution indices.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Code2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multi-Language</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Supports Python, Java, C++, Go, TypeScript, JavaScript, Rust, SQL, and all official LeetCode runtimes.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Privacy Conscious</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Zero LeetCode password custody. You retain 100% intellectual property of your code.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Clean Footer */}
      <Footer />
    </div>
  );
};
