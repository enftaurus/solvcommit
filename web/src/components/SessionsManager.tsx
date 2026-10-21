import React, { useState } from "react";
import {
  Smartphone,
  Laptop,
  Globe,
  Clock,
  Shield,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Device } from "../types";
import { api } from "../api";
import { PairModal } from "./PairModal";

interface SessionsManagerProps {
  devices: Device[];
  loading: boolean;
  onRefresh: () => void;
  onNotify: (msg: string, type?: "success" | "error") => void;
}

export const SessionsManager: React.FC<SessionsManagerProps> = ({
  devices,
  loading,
  onRefresh,
  onNotify,
}) => {
  const [isPairOpen, setIsPairOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<Device | null>(null);

  const handleRevoke = async () => {
    if (!deviceToRevoke) return;
    setRevokingId(deviceToRevoke.id);
    try {
      await api.revokeDevice(deviceToRevoke.id);
      onNotify(`Device "${deviceToRevoke.device_name}" revoked successfully`, "success");
      setDeviceToRevoke(null);
      onRefresh();
    } catch (err: any) {
      onNotify(err.message || "Failed to revoke device", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getDeviceIcon = (ua: string) => {
    const lower = ua.toLowerCase();
    if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Laptop className="h-4 w-4" />;
  };

  const activeDevices = devices.filter((d) => !d.revoked_at);
  const revokedDevices = devices.filter((d) => !!d.revoked_at);

  return (
    <div className="space-y-6 max-w-5xl animate-fadeIn">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Extensions
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Browser extensions authorized to capture and sync accepted solutions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Chrome & Firefox ready
          </span>
        </div>
      </div>

      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Paired Browser Extensions
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {activeDevices.length} Active
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Currently paired browser extensions. (Edge & Safari rolling out soon).
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200/60"
            title="Refresh devices"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setIsPairOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition-all shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Pair Extension</span>
          </button>
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200/70 bg-white/70">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span>Zero LeetCode Credentials</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            The backend never receives or stores your LeetCode password or session cookie.
            Submissions are read locally in the browser tab.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/70 bg-white/70">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800">
            <Globe className="h-4 w-4 text-blue-600" />
            <span>Never IP Bound</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Sessions are not bound to an IP address. Switching Wi-Fi, using VPNs, or changing
            locations will never interrupt your extension sync.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/70 bg-white/70">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800">
            <CheckCircle2 className="h-4 w-4 text-indigo-600" />
            <span>SHA-256 Hashed Tokens</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Only SHA-256 hashes of refresh tokens are kept in PostgreSQL. Tokens rotate on every
            refresh with automatic reuse breach detection.
          </p>
        </div>
      </div>

      {/* Device List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Active Extensions</h3>
          <span className="text-xs text-slate-400">
            {activeDevices.length} registered {activeDevices.length === 1 ? "device" : "devices"}
          </span>
        </div>

        {activeDevices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <Smartphone className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No active browser extensions</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Pair your Chrome or Firefox extension to begin automatically publishing accepted
              submissions to GitHub.
            </p>
            <button
              onClick={() => setIsPairOpen(true)}
              className="mt-4 inline-flex items-center space-x-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Pair Your First Extension</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeDevices.map((device) => (
              <div
                key={device.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                    {getDeviceIcon(device.user_agent || "")}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {device.device_name}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                        Connected
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-md font-mono text-[11px]">
                      {device.user_agent || "Browser Extension Client"}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>Paired: {formatDate(device.created_at)}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>Last Active: {formatDate(device.last_seen_at)}</span>
                      </span>
                      {device.last_ip && (
                        <span className="flex items-center space-x-1">
                          <Globe className="h-3 w-3" />
                          <span>IP: {device.last_ip}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center self-end sm:self-center">
                  <button
                    onClick={() => setDeviceToRevoke(device)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Revoke</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked Devices History */}
      {revokedDevices.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden opacity-80">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Revoked History</h3>
            <span className="text-xs text-slate-400">
              {revokedDevices.length} terminated sessions
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {revokedDevices.map((device) => (
              <div
                key={device.id}
                className="p-4 flex items-center justify-between text-xs bg-slate-50/40"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-slate-400">{getDeviceIcon(device.user_agent || "")}</div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-slate-700">{device.device_name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                        Revoked
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Terminated on {formatDate(device.revoked_at)}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  ID: {device.id.slice(0, 8)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {deviceToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
            onClick={() => setDeviceToRevoke(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/10">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Revoke Device Access</h3>
                <p className="text-xs text-slate-500">This action takes effect immediately</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to revoke <strong>{deviceToRevoke.device_name}</strong>? The
              browser extension will immediately lose access and will stop publishing submissions
              until paired again.
            </p>

            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeviceToRevoke(null)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={revokingId === deviceToRevoke.id}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50 transition-all shadow-xs"
              >
                {revokingId === deviceToRevoke.id ? "Revoking..." : "Confirm Revocation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pair Modal */}
      <PairModal
        isOpen={isPairOpen}
        onClose={() => setIsPairOpen(false)}
        onPaired={() => {
          onNotify("Device paired successfully!", "success");
          onRefresh();
        }}
      />
    </div>
  );
};
