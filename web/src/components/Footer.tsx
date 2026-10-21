import React from "react";
import { Github, Shield, FileText, HelpCircle, Mail } from "lucide-react";

interface FooterProps {
  onNavigate?: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (path.startsWith("http") || path.startsWith("mailto:")) {
      return; // External or mailto link
    }
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  return (
    <footer
      role="contentinfo"
      aria-label="Site Footer"
      className="border-t border-slate-200/80 bg-white py-10 text-sm text-slate-500 selection:bg-slate-200"
    >
      <div className="max-w-[1536px] mx-auto px-4 sm:px-8 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-5">
        {/* Brand & Dynamic Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="SolvCommit" className="h-full w-full object-cover" />
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">SolvCommit</span>
          </div>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
            Product of Eterno Labs
          </span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="text-sm">© {currentYear} SolvCommit. All rights reserved.</span>
        </div>

        {/* Legal & Support Links */}
        <nav aria-label="Legal and Support Links" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-sm font-medium">
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, "/")}
            className="hover:text-slate-900 transition-colors"
          >
            Home
          </a>
          <a
            href="/privacy"
            onClick={(e) => handleLinkClick(e, "/privacy")}
            className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
          >
            <Shield className="h-4 w-4 text-slate-400" />
            <span>Privacy Policy</span>
          </a>
          <a
            href="/terms"
            onClick={(e) => handleLinkClick(e, "/terms")}
            className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
          >
            <FileText className="h-4 w-4 text-slate-400" />
            <span>Terms of Service</span>
          </a>
          <a
            href="/support"
            onClick={(e) => handleLinkClick(e, "/support")}
            className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
            <span>Support</span>
          </a>
          <a
            href="/contact"
            onClick={(e) => handleLinkClick(e, "/contact")}
            className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
          >
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            <span>Contact</span>
          </a>
          <a
            href="https://github.com/enftaurus/solvcommit"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository (opens in new tab)"
            className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            <span>GitHub</span>
          </a>
        </nav>
      </div>
    </footer>
  );
};
