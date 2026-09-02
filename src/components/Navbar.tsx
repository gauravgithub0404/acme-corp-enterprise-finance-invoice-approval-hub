import React, { useState } from 'react';
import { 
  Layers, Sparkles, ShieldCheck, PlusCircle, HelpCircle, User, Code2, Database,
  LogIn, LogOut, ChevronDown, Check, Shield, Cpu, Zap, Github, UploadCloud
} from 'lucide-react';
import { FloeStudioUser } from '../types/auth';

interface NavbarProps {
  currentView: 'dashboard' | 'chat' | 'review' | 'generating' | 'app_detail' | 'standalone_testbed' | 'standalone_app' | 'login';
  onNavigate: (view: 'dashboard' | 'chat' | 'review' | 'generating' | 'app_detail' | 'standalone_testbed' | 'standalone_app' | 'login') => void;
  onOpenAuditLogs: () => void;
  onOpenUiSuggestions: () => void;
  onOpenHowItWorks: () => void;
  onOpenInfrastructure: () => void;
  onOpenGovernanceCenter: () => void;
  onOpenAiSettings: () => void;
  onOpenGitHubSync?: () => void;
  onOpenCleanRender?: () => void;
  activeAiModel?: string;
  activeAiProvider?: string;
  isDevMode: boolean;
  onToggleDevMode: () => void;
  appName?: string;
  currentUser?: FloeStudioUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenAuditLogs,
  onOpenUiSuggestions,
  onOpenHowItWorks,
  onOpenInfrastructure,
  onOpenGovernanceCenter,
  onOpenAiSettings,
  onOpenGitHubSync,
  onOpenCleanRender,
  activeAiModel = 'gpt-oss:120b-cloud',
  activeAiProvider = 'ollama',
  isDevMode,
  onToggleDevMode,
  appName,
  currentUser,
  onOpenLogin,
  onLogout
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Breadcrumb */}
        <div className="flex items-center gap-4">
          <button
            id="nav-logo-btn"
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:bg-indigo-700 transition-colors">
              <Layers className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                Floe
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  No-Code AI
                </span>
              </span>
              <p className="text-[11px] text-slate-500 font-medium">Workplace App Builder</p>
            </div>
          </button>

          {appName && currentView !== 'dashboard' && currentView !== 'login' && (
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-400 pl-3 border-l border-slate-200">
              <span className="text-slate-700 font-medium truncate max-w-[220px] bg-slate-100 px-2 py-0.5 rounded text-xs">
                {appName}
              </span>
            </div>
          )}
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Live Infrastructure & PostgreSQL Status Badge */}
          <button
            id="nav-infra-btn"
            onClick={onOpenInfrastructure}
            title="Inspect Connected Render PostgreSQL Database & Render API status"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Render Postgres</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200/60 text-emerald-900 font-mono">
              Live
            </span>
          </button>

          {/* GitHub Sync & Live Auto-Deploy Modal Button */}
          {onOpenGitHubSync && (
            <button
              id="nav-github-sync-btn"
              onClick={onOpenGitHubSync}
              title="Push code directly to GitHub repository & trigger Render auto-deploy"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white border border-slate-700 hover:bg-slate-800 transition-all shadow-xs"
            >
              <Github className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">GitHub Sync</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 font-bold uppercase tracking-wider">
                CI/CD
              </span>
            </button>
          )}

          {/* Clean Render & Cache Purge Button */}
          {onOpenCleanRender && (
            <button
              id="nav-clean-render-btn"
              onClick={onOpenCleanRender}
              title="Clean Render cache and deploy newly generated domain"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-all shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Clean Render</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-bold uppercase tracking-wider">
                Purge
              </span>
            </button>
          )}

          {/* AI Provider & Active Model Selector Badge */}
          <button
            id="nav-ai-provider-btn"
            onClick={onOpenAiSettings}
            title="Configure AI Provider (Ollama gpt-oss:120b-cloud, Gemini, OpenAI, Claude) and API Keys"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white border border-slate-700 hover:bg-slate-800 transition-all shadow-xs group"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline font-mono">
              {activeAiProvider === 'ollama' ? '🦙' : activeAiProvider === 'gemini' ? '✨' : '⚡'}
            </span>
            <span className="truncate max-w-[120px] font-mono text-[11px] text-indigo-200">
              {activeAiModel.replace('gpt-oss:', '120b-').replace(':cloud', '')}
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/30 text-indigo-300 font-bold uppercase tracking-wider border border-indigo-400/30">
              AI
            </span>
          </button>

          {/* User Mode Toggle: Simple / Friendly (Default) vs Developer Mode */}
          <button
            id="nav-devmode-toggle-btn"
            onClick={onToggleDevMode}
            title={isDevMode ? "Switch to Simple Friendly Mode" : "Switch to Technical Developer Mode"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isDevMode
                ? 'bg-slate-900 text-slate-100 border-slate-700'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            {isDevMode ? (
              <>
                <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Developer Mode</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Friendly Mode</span>
                <span className="sm:hidden">Simple</span>
              </>
            )}
          </button>

          {/* How It Works Guide Button */}
          <button
            id="nav-how-it-works-btn"
            onClick={onOpenHowItWorks}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden md:inline">How it Works</span>
          </button>

          {/* UI Suggestions Advisor Button */}
          <button
            id="nav-ui-suggestions-btn"
            onClick={onOpenUiSuggestions}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden lg:inline">Design Tips</span>
          </button>

          {/* Audit Logs Button */}
          <button
            id="nav-audit-logs-btn"
            onClick={onOpenAuditLogs}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden lg:inline">Activity Logs</span>
          </button>

          {/* Governance Center Button: hard floors, ladder, circuit breaker, agent audit trail */}
          <button
            id="nav-governance-center-btn"
            onClick={onOpenGovernanceCenter}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 border border-indigo-200 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden lg:inline">Governance</span>
          </button>

          {currentView !== 'chat' && currentView !== 'login' && (
            <button
              id="nav-new-app-btn"
              onClick={() => onNavigate('chat')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create App</span>
            </button>
          )}

          {/* User Account / Login State */}
          {currentUser ? (
            <div className="relative">
              <button
                id="nav-user-profile-btn"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left"
              >
                <div className={`w-7 h-7 rounded-md ${currentUser.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
                  {currentUser.avatar}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[110px]">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium truncate max-w-[110px]">
                    {currentUser.roleTitle.split('&')[0]}
                  </p>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${currentUser.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center font-bold text-sm shadow-xs`}>
                          {currentUser.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</p>
                          <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                            {currentUser.organization}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="px-3 py-2 border-b border-slate-100 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Access Tier:</span>
                        <strong className="text-slate-800">{currentUser.tier}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Auth Token:</span>
                        <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded">
                          Active (256-bit)
                        </span>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        id="nav-user-switch-btn"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenLogin();
                        }}
                        className="w-full px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-2.5 transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Switch Persona / Login Screen</span>
                      </button>

                      <button
                        id="nav-user-logout-btn"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>Sign Out of Floe</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              id="nav-login-btn"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
};
