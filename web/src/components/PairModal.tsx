import React, { useState } from "react";
import { X, Copy, Check, Smartphone, Key, ShieldCheck, HelpCircle } from "lucide-react";
import { api } from "../api";

interface PairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaired?: () => void;
}

export const PairModal: React.FC<PairModalProps> = ({ isOpen, onClose, onPaired }) => {
  const [deviceName, setDeviceName] = useState("Chrome Extension");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pairData, setPairData] = useState<{
    device_id: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.pairDevice(deviceName.trim() || "Browser Extension");
      setPairData(res);
      if (onPaired) onPaired();
    } catch (err: any) {
      setError(err.message || "Failed to generate pairing token");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pairingPayloadString = pairData
    ? JSON.stringify(
        {
          deviceID: pairData.device_id,
          accessToken: pairData.access_token,
          refreshToken: pairData.refresh_token,
        },
        null,
        2
      )
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/10 transition-all">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Pair Browser Extension</h3>
              <p className="text-xs text-slate-500">Connect Chrome or Firefox to your SolvCommit account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {!pairData ? (
          <form onSubmit={handleGenerate} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Device Name / Label
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Chrome on MacBook, Firefox Personal"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800 transition-colors"
                required
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Helps you identify which browser session pushes accepted submissions.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-medium text-slate-700">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Security Assurance</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                SolvCommit issues a cryptographically signed pair token. Refresh tokens are stored
                only as SHA-256 hashes on the server with reuse detection.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 transition-all shadow-xs"
              >
                {loading ? "Generating..." : "Generate Pairing Code"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center space-x-2">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Pairing credentials successfully generated for <strong>{deviceName}</strong>.</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center space-x-1.5">
                  <Key className="h-3.5 w-3.5 text-slate-500" />
                  <span>Extension Pairing Token</span>
                </label>
                <button
                  type="button"
                  onClick={() => copyToClipboard(pairingPayloadString)}
                  className="inline-flex items-center space-x-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Payload</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs font-mono text-slate-200 leading-relaxed select-all">
                  {pairingPayloadString}
                </pre>
              </div>
            </div>

            {/* Instruction Steps */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                <span>How to pair in Chrome or Firefox:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                <li>Click the <strong>SolvCommit</strong> icon in your browser extension toolbar.</li>
                <li>Click <strong>Pair Device</strong> in the popup window.</li>
                <li>Paste the payload above and click <strong>Connect</strong>.</li>
                <li>Your browser is now securely paired! Every accepted LeetCode submission will sync automatically.</li>
              </ol>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition-all shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
