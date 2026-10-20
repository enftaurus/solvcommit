import React from "react";
import { Mail, ArrowLeft, Shield, Github, Clock } from "lucide-react";

interface ContactPageProps {
  onBack: () => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onBack }) => {
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
            <span className="font-semibold text-sm tracking-tight text-slate-900">SolvCommit Inquiries</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
              Contact
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200">
            <Mail className="h-3.5 w-3.5 text-slate-600" />
            <span>Get in Touch</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Contact Us</h1>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
            Have a question about SolvCommit, feature feedback, partnership proposals, or security disclosures?
            Reach out through our direct communication channels below.
          </p>
        </div>

        {/* Contact Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Card 1: Email */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Primary Support & Inquiries</h2>
              <p className="text-slate-500 mt-0.5">Direct email to the SolvCommit engineering and support team.</p>
            </div>
            <div className="pt-2">
              <a
                href="mailto:valyrianminds@zohomail.in"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition shadow-xs text-xs"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>valyrianminds@zohomail.in</span>
              </a>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Typical response time: 24–48 hours</span>
            </div>
          </div>

          {/* Card 2: Security & Privacy */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Security & Privacy Disclosures</h2>
              <p className="text-slate-500 mt-0.5">Vulnerability reports, responsible disclosure, and privacy requests.</p>
            </div>
            <p className="text-slate-600 leading-relaxed">
              We take security and user data privacy seriously. If you discover a vulnerability or security flaw, please
              report it with detailed reproduction steps to our team before public disclosure.
            </p>
            <div className="pt-1">
              <a
                href="mailto:valyrianminds@zohomail.in?subject=Security%20Disclosure"
                className="text-emerald-700 font-semibold hover:underline"
              >
                Report Security Issue →
              </a>
            </div>
          </div>

          {/* Card 3: Open Source Discussions & Issues */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 md:col-span-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">GitHub Community & Issue Tracker</h2>
              <p className="text-slate-500 mt-0.5">Open source development, bug reports, and roadmap proposals.</p>
            </div>
            <p className="text-slate-600 leading-relaxed">
              SolvCommit is an open source initiative. For bug reports or feature requests, feel free to open an issue or
              participate in discussion threads on GitHub:
            </p>
            <div>
              <a
                href="https://github.com/enftaurus/solvcommit"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:underline"
              >
                <span>github.com/enftaurus/solvcommit</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
