import React from "react";
import { ShieldCheck, ArrowLeft, Lock, Database, RefreshCw } from "lucide-react";

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
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
            <span className="font-semibold text-sm tracking-tight text-slate-900">SolvCommit Legal</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
              Policy v1.0
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Official Privacy Policy</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Privacy Policy</h1>
          <p className="text-xs text-slate-500">
            Effective Date: October 21, 2026 • Policy Version: 1.0 • Operator Contact:{" "}
            <a href="mailto:valyrianminds@zohomail.in" className="text-blue-600 underline">
              valyrianminds@zohomail.in
            </a>
          </p>
        </div>

        {/* Executive Summary Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-400">
            Core Privacy Architecture & Invariants
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                <Lock className="h-4 w-4 text-emerald-600" />
                <span>Zero LeetCode Credentials</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Our backend never requests, handles, or stores your LeetCode password or session cookies.
                Captures happen locally inside your browser extension.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                <Database className="h-4 w-4 text-blue-600" />
                <span>Code Only in Kafka</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Problem source code is never stored in PostgreSQL. It is streamed exclusively via Kafka
                with a strict 7-day retention limit and committed to GitHub.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                <RefreshCw className="h-4 w-4 text-purple-600" />
                <span>Ephemeral Tokens</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                User GitHub OAuth tokens are discarded immediately after verifying identity and App
                installation IDs. No personal GitHub OAuth tokens are ever persisted.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <section className="space-y-6 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">1. Service Operator & Privacy Contact</h2>
            <p>
              SolvCommit ("we", "us", or "our") is an open automated synchronization service providing integration
              between user LeetCode activities and personal GitHub repositories.
            </p>
            <p>
              For any questions, data subject access requests, or privacy inquiries, please contact our designated privacy
              officer at:{" "}
              <a href="mailto:valyrianminds@zohomail.in" className="font-semibold text-slate-900 underline">
                valyrianminds@zohomail.in
              </a>
              .
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">2. Categories of Information Collected</h2>
            <p>We process only the minimum categories of information necessary to deliver automated repository syncing:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                <strong>GitHub Account Identifiers:</strong> Your public GitHub user ID, GitHub username/login, and
                associated GitHub App installation ID granted during connection.
              </li>
              <li>
                <strong>Extension Session Credentials:</strong> Randomly generated device IDs and cryptographic SHA-256
                hashes of rotating refresh tokens. Raw refresh tokens are never stored in plain text.
              </li>
              <li>
                <strong>Submission Metadata:</strong> LeetCode submission ID, problem title slug, programming language,
                submission timestamp, status verdict (e.g. "Accepted"), and a SHA-256 content checksum.
              </li>
              <li>
                <strong>Accepted Source Code:</strong> When a submission receives an "Accepted" verdict, the code snippet is
                captured by the extension and queued for commit creation.
              </li>
              <li>
                <strong>Technical Network Diagnostics:</strong> Client IP address (for security alerting and token reuse
                detection only; sessions are never bound to an IP) and browser user-agent string.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">3. Purpose and Legal Basis for Processing</h2>
            <p>We process your data strictly under the following legal bases:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                <strong>Performance of a Contract:</strong> Syncing accepted solutions to your selected destination
                repository, managing device pairings, and providing dashboard pipeline metrics.
              </li>
              <li>
                <strong>Legitimate Interests:</strong> Preventing token replay attacks, enforcing single-use OAuth
                states, maintaining pipeline deduplication, and preventing service abuse.
              </li>
              <li>
                <strong>Legal Compliance:</strong> Retaining records where mandatory under applicable regulatory obligations.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">4. Data Flow & Third-Party Platforms</h2>
            <p>Data moves strictly across verified endpoints with end-to-end encryption:</p>
            <ol className="list-decimal list-inside space-y-1.5 pl-2">
              <li>
                <strong>LeetCode Web Session:</strong> The extension detects completed submissions inside your browser tab
                using DOM events. Non-accepted submissions are immediately discarded on client side.
              </li>
              <li>
                <strong>Backend Queue (Kafka):</strong> Accepted submissions are sent to the SolvCommit backend over TLS and
                enqueued in Apache Kafka topic <code>submissions</code>.
              </li>
              <li>
                <strong>GitHub App Publishing:</strong> The background publisher worker consumes the message, authenticates
                using the SolvCommit GitHub App private key, verifies the destination repository, and commits the code.
              </li>
              <li>
                <strong>Metadata Persistence:</strong> PostgreSQL stores pipeline status, commit SHA, and path metadata.
                The code is deleted from Kafka upon retention expiry (7 days).
              </li>
            </ol>
            <p>
              We do <strong>not</strong> sell, rent, or monetize your personal data or source code. We do not use third-party
              advertising trackers or behavioral analytics SDKs.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">5. Storage Boundaries & Retention Schedule</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 font-semibold text-slate-900">
                  <tr>
                    <th className="px-3.5 py-2">Data Category</th>
                    <th className="px-3.5 py-2">Storage Location</th>
                    <th className="px-3.5 py-2">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="px-3.5 py-2 font-medium">Source Code</td>
                    <td className="px-3.5 py-2">Kafka Broker Messages</td>
                    <td className="px-3.5 py-2">Strict 7 Days (Purged automatically)</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 font-medium">User Profile & Connections</td>
                    <td className="px-3.5 py-2">PostgreSQL Database</td>
                    <td className="px-3.5 py-2">Until account deletion by user</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 font-medium">Device Session Hashes</td>
                    <td className="px-3.5 py-2">PostgreSQL (Hashed)</td>
                    <td className="px-3.5 py-2">Rotates on every use; purged on revocation/deletion</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2 font-medium">Submission Metadata</td>
                    <td className="px-3.5 py-2">PostgreSQL Database</td>
                    <td className="px-3.5 py-2">Until account deletion by user</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">6. User Rights & Account Deletion</h2>
            <p>
              Under applicable data protection laws (including GDPR and CCPA where applicable), you have rights regarding your
              personal data:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                <strong>Instant Account Deletion:</strong> You can permanently delete your account directly inside the web
                dashboard at <em>Settings → Danger Zone → Delete Account</em>. This immediately deletes your user profile,
                device tokens, repository links, and submission records in a single database transaction.
              </li>
              <li>
                <strong>Preservation of GitHub Commits:</strong> Solutions committed to your GitHub repositories remain your
                exclusive property on GitHub and are not modified or deleted when deleting your SolvCommit account.
              </li>
              <li>
                <strong>Privacy Requests by Email:</strong> If you cannot access your account or GitHub account, email us at{" "}
                <a href="mailto:valyrianminds@zohomail.in" className="text-blue-600 underline">
                  valyrianminds@zohomail.in
                </a>{" "}
                to request manual deletion, export, or rectification.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">7. Security Safeguards & Limitations</h2>
            <p>
              We implement industry-standard cryptographic and architectural protections:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Cryptographic HMAC-SHA256 signatures for cookie sessions.</li>
              <li>SHA-256 token hashing with family reuse breach detection.</li>
              <li>Zero persistent personal GitHub OAuth tokens (installation tokens minted ephemerally via GitHub App RSA key).</li>
              <li>Source code exclusion from relational database tables.</li>
            </ul>
            <p className="text-slate-500 italic">
              While we adhere to rigorous security invariants, no internet service can guarantee 100% absolute security against
              all theoretical threats.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">8. Children's Privacy</h2>
            <p>
              SolvCommit is not directed to children under 13 years of age (or under 16 in the EEA/UK). We do not knowingly
              collect personal information from children.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">9. Policy Changes & Versioning</h2>
            <p>
              We may update this policy periodically to reflect operational or regulatory updates. When material changes
              occur, we will update the version number and require renewed affirmative consent upon login before resuming sync
              pipeline services.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};
