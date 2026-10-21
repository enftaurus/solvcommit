import React, { useState } from "react";
import {
  Pause,
  Play,
  LogOut,
  Sparkles,
  LayoutDashboard,
  ListFilter,
  FolderGit2,
  Smartphone,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { UserProfile, SyncStatus } from "../types";
import { api } from "../api";

export type NavTab = "overview" | "submissions" | "repository" | "devices" | "settings";

interface HeaderProps {
  user: UserProfile | null;
  syncStatus: SyncStatus | null;
  isOnline: boolean;
  isDemo?: boolean;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  totalSubmissions?: number;
  activeDeviceCount?: number;
  hasRepo?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onExitDemo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  syncStatus,
  isOnline,
  isDemo = false,
  activeTab,
  onSelectTab,
  totalSubmissions = 0,
  activeDeviceCount = 0,
  hasRepo = false,
  onRefresh,
  onLogout,
  onExitDemo,
}) => {
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: "submissions",
      label: "Submissions",
      icon: <ListFilter className="h-4 w-4" />,
      badge: totalSubmissions > 0 ? (
        <span className="font-mono text-xs px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
          {totalSubmissions}
        </span>
      ) : undefined,
    },
    {
      id: "repository",
      label: "Repository",
      icon: <FolderGit2 className="h-4 w-4" />,
      badge: hasRepo ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Connected" />
      ) : undefined,
    },
    {
      id: "devices",
      label: "Extensions",
      icon: <Smartphone className="h-4 w-4" />,
      badge: activeDeviceCount > 0 ? (
        <span className="font-mono text-xs px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
          {activeDeviceCount}
        </span>
      ) : undefined,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1536px] items-center justify-between px-4 sm:px-8 lg:px-12">
        {/* Brand & Logo */}
        <div className="flex items-center gap-7">
          <a href="/" className="flex items-center gap-3 group">
            <div className="h-11 w-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shadow-xs group-hover:scale-105 transition">
              <img
                src="/logo.png"
                alt="SolvCommit"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition">
                SolvCommit
              </span>
              {isDemo && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Demo
                </span>
              )}
            </div>
          </a>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden md:flex items-center space-x-1.5 pl-6 border-l border-slate-200">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-base font-semibold transition-all ${
                      isActive
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Health indicator */}
          <div
            className={`hidden sm:flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold border ${
              isOnline
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span>{isOnline ? "Pipeline Live" : "API Offline"}</span>
          </div>

          {user && syncStatus && (
            <>
              {/* Pause / Resume Button */}
              <button
                onClick={handleTogglePause}
                disabled={isTogglingPause}
                className={`hidden sm:inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  syncStatus.is_paused
                    ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 active:scale-95"
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-95"
                }`}
                title={syncStatus.is_paused ? "Resume publishing" : "Pause publishing"}
              >
                {syncStatus.is_paused ? (
                  <>
                    <Play className="h-4 w-4 fill-amber-700" />
                    <span>Paused</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    <span>Sync Active</span>
                  </>
                )}
              </button>

              {/* User Identity / Logout */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <span className="text-sm text-slate-600 font-semibold hidden lg:inline">
                  {isDemo ? "demo-developer" : `User #${user.github_user_id}`}
                </span>
                {isDemo ? (
                  <button
                    onClick={onExitDemo}
                    className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                  >
                    Exit Demo
                  </button>
                ) : (
                  <button
                    onClick={onLogout}
                    className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                    title="Sign out"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                )}
              </div>
            </>
          )}

          {/* Mobile Menu Toggle */}
          {user && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
