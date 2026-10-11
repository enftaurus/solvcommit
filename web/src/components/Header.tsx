import React, { useState } from "react";
import { Pause, Play, LogOut, Sparkles } from "lucide-react";
import { UserProfile, SyncStatus } from "../types";
import { api } from "../api";

interface HeaderProps {
  user: UserProfile | null;
  syncStatus: SyncStatus | null;
  isOnline: boolean;
  isDemo?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onExitDemo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  syncStatus,
  isOnline,
  isDemo = false,
  onRefresh,
  onLogout,
  onExitDemo,
}) => {
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  const handleTogglePause = async () => {
    if (!syncStatus || isTogglingPause) return;
    setIsTogglingPause(true);
    try {
      if (syncStatus.is_paused) {
        await api.resumeSync();
      } else {
        await api.pauseSync();
      }
      onRefresh();
    } catch (err: any) {
      alert("Failed to toggle pause state: " + err.message);
    } finally {
      setIsTogglingPause(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight text-zinc-950">
              LeetSync
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 border border-zinc-200">
              v1.0
            </span>
            {isDemo && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-600" />
                Demo
              </span>
            )}
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-4">
          {/* Health Status Indicator */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
              isOnline
                ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                : "bg-rose-50 text-rose-700 border-rose-200/60"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            {isOnline ? "Pipeline Live" : "API Offline"}
          </div>

          {user && syncStatus && (
            <>
              {/* Pause / Resume Button */}
              <button
                onClick={handleTogglePause}
                disabled={isTogglingPause}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  syncStatus.is_paused
                    ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 active:scale-95"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80 active:scale-95"
                }`}
                title={syncStatus.is_paused ? "Resume publishing" : "Pause publishing"}
              >
                {syncStatus.is_paused ? (
                  <>
                    <Play className="h-3.5 w-3.5 fill-amber-700" />
                    <span>Paused</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    <span>Sync Active</span>
                  </>
                )}
              </button>

              {/* User Dropdown / Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
                <span className="text-xs text-zinc-500 hidden sm:inline">
                  {isDemo ? "demo-developer" : `User #${user.github_user_id}`}
                </span>
                {isDemo ? (
                  <button
                    onClick={onExitDemo}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                    title="Exit Demo Mode"
                  >
                    Exit Demo
                  </button>
                ) : (
                  <button
                    onClick={onLogout}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
