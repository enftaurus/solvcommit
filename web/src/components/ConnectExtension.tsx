import React, { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, Laptop, ArrowRight } from "lucide-react";
import { api } from "../api";

interface ConnectExtensionProps {
  onGoToDashboard: () => void;
}

export const ConnectExtension: React.FC<ConnectExtensionProps> = ({ onGoToDashboard }) => {
  const [status, setStatus] = useState<"connecting" | "paired" | "timeout" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const pairingInitiated = useRef(false);

  useEffect(() => {
    if (pairingInitiated.current) return;
    pairingInitiated.current = true;

    const queryParams = new URLSearchParams(window.location.search);
    const state = queryParams.get("state");

    if (!state) {
      setStatus("error");
      setErrorMessage("Missing 'state' query parameter in URL.");
      return;
    }

    let intervalId: any = null;
    let attempts = 0;
    const maxAttempts = 20;

    const handleMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      if (e.data && e.data.type === "SOLVCOMMIT_PAIR_RESULT") {
        if (e.data.ok) {
          if (intervalId) clearInterval(intervalId);
          window.removeEventListener("message", handleMessage);
          setStatus("paired");
          // Remove state from query params cleanly
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } else {
          if (intervalId) clearInterval(intervalId);
          window.removeEventListener("message", handleMessage);
          setStatus("error");
          setErrorMessage(e.data.error || "Extension rejected pairing credentials.");
        }
      }
    };

    window.addEventListener("message", handleMessage);

    // Call api.pairDevice exactly once
    api.pairDevice("Browser Extension")
      .then((pairData) => {
        const payload = {
          type: "SOLVCOMMIT_PAIR",
          state: state,
          deviceID: pairData.device_id,
          accessToken: pairData.access_token,
          refreshToken: pairData.refresh_token,
        };

        // Post message immediately once
        window.postMessage(payload, window.location.origin);
        attempts++;

        // Then repeat every 500ms up to 20 times until response or timeout
        intervalId = setInterval(() => {
          attempts++;
          if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            window.removeEventListener("message", handleMessage);
            setStatus("timeout");
            return;
          }
          window.postMessage(payload, window.location.origin);
        }, 500);
      })
      .catch((err) => {
        window.removeEventListener("message", handleMessage);
        setStatus("error");
        setErrorMessage(err.message || "Failed to generate pairing token.");
      });

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 p-6 sm:p-8 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
          <Laptop className="h-7 w-7" />
        </div>

        {status === "connecting" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Connecting Extension...</h2>
            <div className="flex items-center justify-center space-x-2 text-slate-600 text-sm">
              <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-800 animate-spin" />
              <span>Communicating with browser extension</span>
            </div>
            <p className="text-xs text-slate-400">
              Please wait while SolvCommit establishes a secure pairing channel.
            </p>
          </div>
        )}

        {status === "paired" && (
          <div className="space-y-4">
            <div className="inline-flex p-2 rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Extension Paired!</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your browser extension has been successfully paired. Every accepted LeetCode submission will now sync automatically to your repository.
            </p>
            <button
              onClick={onGoToDashboard}
              className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition shadow-xs"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {status === "timeout" && (
          <div className="space-y-4">
            <div className="inline-flex p-2 rounded-full bg-amber-50 text-amber-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Extension Not Detected</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              We couldn't connect with the browser extension. Make sure the SolvCommit extension is installed and enabled in your browser.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition shadow-xs"
              >
                Retry Pairing
              </button>
              <button
                onClick={onGoToDashboard}
                className="w-full inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-xs font-medium transition"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="inline-flex p-2 rounded-full bg-rose-50 text-rose-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Pairing Failed</h2>
            <p className="text-xs text-rose-600 leading-relaxed">
              {errorMessage || "An error occurred while pairing the extension."}
            </p>
            <button
              onClick={onGoToDashboard}
              className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition shadow-xs"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
