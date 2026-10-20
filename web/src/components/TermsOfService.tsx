import React from "react";
import { FileText, ArrowLeft, ShieldCheck } from "lucide-react";

interface TermsOfServiceProps {
  onBack: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
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
              Terms v1.0
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
            <FileText className="h-3.5 w-3.5" />
            <span>Terms of Service Agreement</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Terms of Service</h1>
          <p className="text-xs text-slate-500">
            Effective Date: October 21, 2026 • Agreement Version: 1.0 • Contact:{" "}
            <a href="mailto:valyrianminds@zohomail.in" className="text-blue-600 underline">
              valyrianminds@zohomail.in
            </a>
          </p>
        </div>

        {/* Ownership Summary Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span>You Retain Full Ownership of Your Code</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            SolvCommit does <strong>not</strong> claim any intellectual property rights or ownership over your code,
            algorithms, solutions, or repository content. You grant SolvCommit solely the narrow, limited technical
            permission necessary to transmit and push your accepted solutions to your designated GitHub repository.
          </p>
        </div>

        {/* Detailed Sections */}
        <section className="space-y-6 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              By signing in to SolvCommit, pairing the SolvCommit browser extension, or utilizing our synchronization
              services, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these
              Terms, you must discontinue use and disconnect the browser extension.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">2. Description of Service & Eligibility</h2>
            <p>
              SolvCommit provides automated tooling enabling developers to synchronize accepted problem submissions from
              their active LeetCode sessions to their personal GitHub repositories via a Manifest V3 browser extension and an
              event-driven Go backend.
            </p>
            <p>
              You must be at least 13 years of age (or the age of legal majority in your jurisdiction) to use the Service. You
              represent that you have full legal capacity to enter into this agreement.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">3. GitHub Authorization & Permissions</h2>
            <p>
              Connecting SolvCommit requires installing the SolvCommit GitHub App. You authorize SolvCommit to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Read your public GitHub profile and installation associations.</li>
              <li>List repositories authorized under your GitHub App installation.</li>
              <li>Create or update code files and README files solely within the repository you explicitly designate as active.</li>
            </ul>
            <p>
              SolvCommit will <strong>never</strong> delete existing repositories, force-push over git history, or modify
              unrelated files in your GitHub account.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">4. User Rights and Code License</h2>
            <p>
              <strong>Ownership:</strong> You retain complete ownership, copyright, and title to all source code and solution
              text submitted through your account.
            </p>
            <p>
              <strong>Limited Operational License:</strong> Solely for the purpose of operating the synchronization pipeline,
              you grant SolvCommit a worldwide, royalty-free, non-exclusive license to receive, temporarily queue, format,
              and push your code to your designated GitHub repository. This operational license terminates automatically once
              the commit is published or upon account deletion.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">5. Acceptable Use Policy</h2>
            <p>You agree not to use SolvCommit to:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Violate any local, national, or international law, regulation, or third-party rights.</li>
              <li>Upload malicious code, malware, software viruses, or destructive scripts.</li>
              <li>Attempt to circumvent rate limits, authentication cookies, token security, or database boundaries.</li>
              <li>Reverse engineer or disrupt the integrity or performance of the SolvCommit backend or queue infrastructure.</li>
              <li>Misrepresent your identity or unauthorizedly connect GitHub installations belonging to other entities.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">6. Third-Party Platforms (GitHub & LeetCode)</h2>
            <p>
              SolvCommit interacts with independent third-party platforms (GitHub and LeetCode). SolvCommit is not affiliated
              with, endorsed by, or sponsored by GitHub, Inc. or LeetCode. Your use of those platforms remains governed by their
              respective terms of service and privacy policies.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">7. Service Availability & Maintenance</h2>
            <p>
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis. While we strive for continuous uptime, we do not
              guarantee uninterrupted or error-free operation. We reserve the right to perform scheduled maintenance, update
              dependencies, or modify features with reasonable notice where feasible.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">8. Termination & Account Deletion</h2>
            <p>
              You may terminate this agreement at any time by deleting your account via the dashboard (<em>Settings → Danger Zone</em>)
              or uninstalling the browser extension. SolvCommit reserves the right to suspend or terminate accounts that breach
              these Terms or engage in abusive activities.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">9. Disclaimer of Warranties & Limitation of Liability</h2>
            <p className="uppercase text-slate-500 font-medium">
              TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, SOLVCOMMIT DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED,
              INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL SOLVCOMMIT
              BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF CODE OR DATA,
              ARISING FROM YOUR USE OF THE SERVICE.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">10. Governing Law & Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the
              operator operates, without regard to conflict of law principles. [Operator Placeholder: Specific state/country
              jurisdiction to be finalized by operator legal counsel].
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">11. Contact & Inquiries</h2>
            <p>
              For legal questions, breach notifications, or terms inquiries, reach out directly to:{" "}
              <a href="mailto:valyrianminds@zohomail.in" className="font-semibold text-slate-900 underline">
                valyrianminds@zohomail.in
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};
