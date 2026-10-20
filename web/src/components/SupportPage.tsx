import React from "react";
import { ArrowLeft, LifeBuoy, CheckCircle, Mail, Trash2, Key, RefreshCw } from "lucide-react";

interface SupportPageProps {
  onBack: () => void;
}

export const SupportPage: React.FC<SupportPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to SolvCommit</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm tracking-tight text-slate-900">SolvCommit Help</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
              Support Center
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200">
            <LifeBuoy className="h-3.5 w-3.5 text-slate-600" />
            <span>Help & Troubleshooting</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Support & FAQ</h1>
          <p className="text-xs text-slate-500">
            Need assistance or running into an issue? We're here to help. Contact support anytime at:{" "}
            <a href="mailto:valyrianminds@zohomail.in" className="text-blue-600 underline font-medium">
              valyrianminds@zohomail.in
            </a>
          </p>
        </div>

        {/* Quick Contact Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-slate-700" />
              <span>Direct Support Channel</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
              Send us an email with your GitHub username and description of the issue. We respond to all technical and privacy
              requests within 24–48 hours.
            </p>
          </div>
          <a
            href="mailto:valyrianminds@zohomail.in"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Email Support</span>
          </a>
        </div>

        {/* Common Troubleshooting Guides */}
        <section className="space-y-5">
          <h2 className="text-base font-semibold text-slate-900">Troubleshooting Guides</h2>

          <div className="space-y-3">
            {/* Guide 1: Extension Pairing */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-600" />
                <span>Browser Extension shows "Unpaired" or pairing fails</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ensure you have logged into the SolvCommit dashboard first. Open the extension popup in your browser toolbar and
                click <strong>Log in</strong>. A pairing window will open at <code>/connect-extension</code> and pair
                automatically.
              </p>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 space-y-1 border border-slate-100">
                <p>
                  <strong>Manual Fallback:</strong> If automatic bridge communication is blocked by private window settings,
                  navigate to <em>Devices → Pair New Device</em> on your dashboard, copy the JSON pairing payload, click
                  <strong>Pair Manually</strong> in the extension popup, paste the code, and click Connect.
                </p>
              </div>
            </div>

            {/* Guide 2: Destination Repository */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <span>Created repository does not appear in repository selection dropdown</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                When installing the SolvCommit GitHub App, ensure you chose <strong>"All repositories"</strong> or explicitly
                added the new repository to the app's installation. You can adjust repository access at any time at{" "}
                <a
                  href="https://github.com/settings/installations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline font-medium"
                >
                  github.com/settings/installations
                </a>
                , then click <em>"Refresh Repositories"</em> in the dashboard.
              </p>
            </div>

            {/* Guide 3: Submissions Syncing */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>Which LeetCode submissions are synced?</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Only submissions that receive an official <strong>"Accepted"</strong> verdict are synchronized (Rule Non-Negotiable
                4). Wrong Answers, Time Limit Exceeded, and Compile Errors are filtered out on your machine and never queued or
                pushed to GitHub.
              </p>
            </div>

            {/* Guide 4: Account Deletion */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 text-rose-700">
                <Trash2 className="h-4 w-4" />
                <span>How to delete your account or submit a privacy erasure request</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Self-Service:</strong> In your SolvCommit dashboard, navigate to <em>Settings → Danger Zone</em>, click
                <strong>Delete Account</strong>, type <code>DELETE</code>, and confirm. All records, device tokens, and database
                metadata are purged immediately.
              </p>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 space-y-1 border border-slate-100">
                <p>
                  <strong>Cannot Sign In?</strong> If you have lost access to your GitHub account or cannot sign in, send an
                  email from your registered email to{" "}
                  <a href="mailto:valyrianminds@zohomail.in" className="text-slate-900 font-semibold underline">
                    valyrianminds@zohomail.in
                  </a>{" "}
                  with the subject <code>Privacy Request: Account Deletion</code>. We will verify and process your request within 48
                  hours.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
