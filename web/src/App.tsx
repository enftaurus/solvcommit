import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from "lucide-react";
import { UserProfile, SyncStatus, Repository, SubmissionRow, Device } from "./types";
import { api } from "./api";
import { Header } from "./components/Header";
import { Overview } from "./components/Overview";
import { SubmissionsTable } from "./components/SubmissionsTable";
import { RepoSettings } from "./components/RepoSettings";
import { SessionsManager } from "./components/SessionsManager";
import { AccountSettings } from "./components/AccountSettings";
import { LandingPage } from "./components/LandingPage";
import { PairModal } from "./components/PairModal";
import { ConnectExtension } from "./components/ConnectExtension";
import { Footer } from "./components/Footer";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { TermsOfService } from "./components/TermsOfService";
import { SupportPage } from "./components/SupportPage";
import { ContactPage } from "./components/ContactPage";
import { TermsAcceptanceModal } from "./components/TermsAcceptanceModal";
import {
  demoUser,
  demoRepo,
  demoStatus,
  demoSubmissions,
  demoDevices,
} from "./demoData";

export const App: React.FC = () => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem("leetsync_demo_mode") === "true";
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    return localStorage.getItem("leetsync_demo_mode") === "true" ? demoUser : null;
  });
  const [authChecking, setAuthChecking] = useState(() => {
    return localStorage.getItem("leetsync_demo_mode") !== "true";
  });
  const [isOnline, setIsOnline] = useState(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "submissions" | "repository" | "devices" | "settings"
  >("overview");

  // Core Data State
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(() => {
    return localStorage.getItem("leetsync_demo_mode") === "true" ? demoStatus : null;
  });
  const [repo, setRepo] = useState<Repository | null>(() => {
    return localStorage.getItem("leetsync_demo_mode") === "true" ? demoRepo : null;
  });
  const [submissions, setSubmissions] = useState<SubmissionRow[]>(() => {
    return localStorage.getItem("leetsync_demo_mode") === "true" ? demoSubmissions : [];
  });
  const [totalSubmissions, setTotalSubmissions] = useState(() => {
    return localStorage.getItem("leetsync_demo_mode") === "true" ? demoSubmissions.length : 0;
  });
  const [devices, setDevices] = useState<Device[]>(() => {
    return localStorage.getItem("leetsync_demo_mode") === "true" ? demoDevices : [];
  });
  const [loadingData, setLoadingData] = useState(false);

  // Pair Modal
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);

  // Global Toast Notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  const handleEnterDemo = () => {
    localStorage.setItem("leetsync_demo_mode", "true");
    setIsDemoMode(true);
    setUser(demoUser);
    setSyncStatus(demoStatus);
    setRepo(demoRepo);
    setSubmissions(demoSubmissions);
    setTotalSubmissions(demoSubmissions.length);
    setDevices(demoDevices);
    setIsOnline(true);
    setAuthChecking(false);
    showToast("Entered Interactive Demo Mode! All controls are live.", "success");
  };

  const handleExitDemo = () => {
    localStorage.removeItem("leetsync_demo_mode");
    setIsDemoMode(false);
    setUser(null);
    setSyncStatus(null);
    setRepo(null);
    setSubmissions([]);
    setTotalSubmissions(0);
    setDevices([]);
    showToast("Exited demo mode", "success");
  };

  // Check initial user authentication if not in demo mode
  useEffect(() => {
    if (isDemoMode) {
      setAuthChecking(false);
      return;
    }
    let mounted = true;
    const checkAuth = async () => {
      try {
        const u = await api.getMe();
        if (mounted) setUser(u);
      } catch (err: any) {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setAuthChecking(false);
      }
    };
    checkAuth();
    return () => {
      mounted = false;
    };
  }, [isDemoMode]);

  // Refresh all dashboard state
  const loadDashboardData = useCallback(async () => {
    if (isDemoMode) {
      setLoadingData(true);
      setTimeout(() => {
        setLoadingData(false);
        showToast("Demo metrics refreshed", "success");
      }, 300);
      return;
    }

    if (!user) return;
    setLoadingData(true);
    try {
      const [healthOk, statusRes, repoRes, subsRes, devsRes] = await Promise.allSettled([
        api.checkHealth(),
        api.getSyncStatus(),
        api.getSelectedRepo(),
        api.getSubmissions(50, 0),
        api.listDevices(),
      ]);

      if (healthOk.status === "fulfilled") setIsOnline(healthOk.value);
      if (statusRes.status === "fulfilled") setSyncStatus(statusRes.value);
      if (repoRes.status === "fulfilled") setRepo(repoRes.value);
      else if (repoRes.status === "rejected") setRepo(null);

      if (subsRes.status === "fulfilled") {
        setSubmissions(subsRes.value.submissions || []);
        setTotalSubmissions(subsRes.value.total || 0);
      }

      if (devsRes.status === "fulfilled") {
        setDevices(devsRes.value || []);
      }
    } catch (err: any) {
      console.error("Dashboard refresh error:", err);
    } finally {
      setLoadingData(false);
    }
  }, [user, isDemoMode, showToast]);

  // Load data on user authenticated
  useEffect(() => {
    if (user && !isDemoMode) {
      loadDashboardData();
    }
  }, [user, isDemoMode, loadDashboardData]);

  // Periodic heartbeat / status poll (every 15s) when authenticated
  useEffect(() => {
    if (!user || isDemoMode) return;
    const interval = setInterval(async () => {
      try {
        const [h, s] = await Promise.all([api.checkHealth(), api.getSyncStatus()]);
        setIsOnline(h);
        setSyncStatus(s);
      } catch {
        // ignore polling error
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user, isDemoMode]);

  const handleLogout = async () => {
    if (isDemoMode) {
      handleExitDemo();
      return;
    }
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUser(null);
  };

  // Auth checking skeleton loader
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center space-x-3 text-slate-700">
          <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-slate-800 animate-spin" />
          <span className="text-sm font-medium">Loading SolvCommit...</span>
        </div>
      </div>
    );
  }

  // Public legal & support routes (accessible to everyone)
  const currentPath = window.location.pathname;
  if (currentPath === "/privacy") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <div className="flex-1">
          <PrivacyPolicy onBack={() => { window.location.href = "/"; }} />
        </div>
        <Footer />
      </div>
    );
  }
  if (currentPath === "/terms") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <div className="flex-1">
          <TermsOfService onBack={() => { window.location.href = "/"; }} />
        </div>
        <Footer />
      </div>
    );
  }
  if (currentPath === "/support") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <div className="flex-1">
          <SupportPage onBack={() => { window.location.href = "/"; }} />
        </div>
        <Footer />
      </div>
    );
  }
  if (currentPath === "/contact") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <div className="flex-1">
          <ContactPage onBack={() => { window.location.href = "/"; }} />
        </div>
        <Footer />
      </div>
    );
  }

  // Handle /connect-extension route
  const isConnectExtensionRoute = window.location.pathname.startsWith("/connect-extension");

  // Unauthenticated: if accessing /connect-extension, save path and query in sessionStorage
  if (!user) {
    if (isConnectExtensionRoute) {
      sessionStorage.setItem("redirect_after_login", window.location.pathname + window.location.search);
    }
    return <LandingPage onEnterDemo={handleEnterDemo} />;
  }

  // Resume saved redirect path after login if present
  const savedRedirect = sessionStorage.getItem("redirect_after_login");
  if (savedRedirect) {
    sessionStorage.removeItem("redirect_after_login");
    window.location.href = savedRedirect;
    return null;
  }

  if (isConnectExtensionRoute) {
    return <ConnectExtension onGoToDashboard={() => { window.location.href = "/"; }} />;
  }

  const activeDeviceCount = devices.filter((d) => !d.revoked_at).length;

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900 font-sans antialiased flex flex-col selection:bg-slate-200">
      {/* Demo Mode Notice Banner */}
      {isDemoMode && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-xs text-amber-900">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Interactive Demo Mode:</strong> Exploring with sample repository and submissions data. All UI actions are fully interactive.
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleExitDemo}
                className="font-medium text-amber-800 underline hover:text-amber-950 transition-colors"
              >
                Exit Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header with Integrated Navigation */}
      <Header
        user={user}
        syncStatus={syncStatus}
        isOnline={isOnline}
        isDemo={isDemoMode}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        totalSubmissions={totalSubmissions}
        activeDeviceCount={activeDeviceCount}
        hasRepo={Boolean(repo)}
        onRefresh={loadDashboardData}
        onLogout={handleLogout}
        onExitDemo={handleExitDemo}
      />

      {/* Connect GitHub App Banner if not connected */}
      {user && !user.installation_connected && !isDemoMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-900">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>GitHub App not connected:</strong> Install the SolvCommit GitHub App to allow automatic commits to your repository.
              </span>
            </div>
            <a
              href="/api/v1/auth/github/start"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
            >
              Connect GitHub App
            </a>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Tab Viewport */}
        <main className="transition-opacity duration-200">
          {activeTab === "overview" && (
            <Overview
              status={syncStatus}
              repo={repo}
              recentSubmissions={submissions.slice(0, 5)}
              onOpenRepoSettings={() => setActiveTab("repository")}
              onOpenSubmissions={() => setActiveTab("submissions")}
              onOpenPairModal={() => setIsPairModalOpen(true)}
            />
          )}

          {activeTab === "submissions" && (
            <SubmissionsTable
              submissions={submissions}
              total={totalSubmissions}
              repo={repo}
              onRefresh={loadDashboardData}
            />
          )}

          {activeTab === "repository" && (
            <RepoSettings
              currentRepo={repo}
              onRepoUpdated={() => {
                showToast("Repository updated successfully", "success");
                loadDashboardData();
              }}
            />
          )}

          {activeTab === "devices" && (
            <SessionsManager
              devices={devices}
              loading={loadingData}
              onRefresh={loadDashboardData}
              onNotify={showToast}
            />
          )}

          {activeTab === "settings" && syncStatus && (
            <AccountSettings
              user={user}
              syncStatus={syncStatus}
              onRefreshStatus={loadDashboardData}
              onNotify={showToast}
            />
          )}
        </main>
      </div>

      {/* Site-wide Footer */}
      <Footer />

      {/* Mandatory Terms Acceptance Modal if terms not yet accepted */}
      {user && !user.terms_accepted && !isDemoMode && (
        <TermsAcceptanceModal
          onAccepted={async () => {
            showToast("Terms of Service and Privacy Policy accepted. Welcome!", "success");
            try {
              const updated = await api.getMe();
              setUser(updated);
            } catch {
              setUser((prev) => prev ? { ...prev, terms_accepted: true, terms_version: "v1.0" } : null);
            }
            loadDashboardData();
          }}
        />
      )}

      {/* Global Pair Modal */}
      <PairModal
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        onPaired={() => {
          showToast("Extension credentials generated successfully!", "success");
          loadDashboardData();
        }}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2.5 rounded-xl bg-slate-900 text-white px-4 py-3 shadow-lg border border-slate-800 text-xs animate-slideUp">
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};
