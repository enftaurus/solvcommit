import React, { useState } from "react";
import { api } from "../api";

interface Props {
  onAccepted: () => void;
}

export const TermsAcceptanceModal: React.FC<Props> = ({ onAccepted }) => {
  const [agreed, setAgreed] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError("You must review and agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.acceptTerms({
        terms_version: "v1.0",
        privacy_version: "v1.0",
        marketing_consent: marketing,
        channel: "web_onboarding",
      });
      onAccepted();
    } catch (err: any) {
      setError(err?.message || "Failed to record acceptance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 text-zinc-100">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Terms Update • v1.0
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Welcome to SolvCommit
          </h2>
          <p className="text-sm text-zinc-400">
            Before proceeding, please review and accept our updated terms. SolvCommit respects your privacy, stores code strictly in transit, and never claims ownership of your intellectual property.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (e.target.checked) setError(null);
                }}
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 cursor-pointer"
                id="terms-checkbox"
              />
              <span className="text-xs sm:text-sm text-zinc-300 leading-snug">
                I agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  Terms of Service
                </a>{" "}
                and acknowledge the{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  Privacy Policy
                </a>
                . <span className="text-rose-400">*</span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group pt-2 border-t border-zinc-800/60">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 cursor-pointer"
                id="marketing-checkbox"
              />
              <span className="text-xs sm:text-sm text-zinc-400 leading-snug">
                (Optional) Receive occasional updates regarding new SolvCommit features, browser extensions, and service improvements.
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !agreed}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-sm transition-all text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30"
            >
              {loading ? "Recording Acceptance..." : "Accept and Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
