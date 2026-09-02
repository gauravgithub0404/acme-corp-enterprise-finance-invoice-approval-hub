import React, { useState, useEffect } from 'react';
import { 
  Github, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  GitBranch, 
  Send, 
  Lock, 
  Key, 
  Terminal, 
  Check, 
  Copy, 
  X, 
  Layers, 
  UploadCloud, 
  Globe, 
  Radio, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles, 
  Building2, 
  FolderGit2, 
  User, 
  Users, 
  ShieldCheck, 
  Trash2, 
  Download, 
  FolderArchive, 
  AlertTriangle 
} from 'lucide-react';
import { exportAsZip } from '../engine/codegenEngine';
import { LEAVE_MANAGEMENT_IR, DOMAIN_PRESETS } from '../data/domains';

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  activeDomain?: string;
  pendingApproval?: boolean;
  customerName?: string;
  appName?: string;
  initialError?: string;
}

interface RepoStatus {
  connected: boolean;
  exists?: boolean;
  repo: string;
  branch: string;
  html_url?: string;
  isPrivate?: boolean;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
  hasPat: boolean;
  error?: string;
}

interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  orgs: { login: string; avatar_url: string; description?: string }[];
}

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  activeDomain,
  pendingApproval = false,
  customerName: initialCustomerName,
  appName: initialAppName,
  initialError
}) => {
  const [repoStatus, setRepoStatus] = useState<RepoStatus | null>(null);
  const [patToken, setPatToken] = useState('');
  
  // Customer & Repo Configuration State
  const [customerName, setCustomerName] = useState(initialCustomerName || 'Acme Corp');
  const [appName, setAppName] = useState(initialAppName || 'Finance Invoice Approval');
  const [selectedOwner, setSelectedOwner] = useState('gauravgithub0404');
  const [repoMode, setRepoMode] = useState<'customer_new' | 'existing'>('customer_new');
  const [customRepoName, setCustomRepoName] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [isPrivate, setIsPrivate] = useState(false);
  const [autoPushEnabled, setAutoPushEnabled] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  
  // Render Connection State
  const [renderApiKey, setRenderApiKey] = useState('');
  const [renderStatus, setRenderStatus] = useState<{ connected: boolean; servicesCount?: number; postgresCount?: number; error?: string } | null>(null);
  const [isTestingRender, setIsTestingRender] = useState(false);

  // GitHub User info
  const [gitHubUser, setGitHubUser] = useState<GitHubUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ 
    success: boolean; 
    message: string; 
    repoUrl?: string; 
    repo?: string; 
    createdNewRepo?: boolean; 
    commitSha?: string; 
    deployTriggered?: boolean 
  } | null>(null);
  const [savedSettingsSuccess, setSavedSettingsSuccess] = useState(false);

  const sanitizeSlug = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const computedCustomerRepoName = customRepoName.trim() || 
    (customerName ? `${sanitizeSlug(customerName)}-${sanitizeSlug(appName || 'app')}` : 'floe-app');

  const activeTargetRepo = repoMode === 'customer_new'
    ? `${selectedOwner}/${computedCustomerRepoName}`
    : (customRepoName.trim() || `${selectedOwner}/FloeFinal`);

  const fetchGitHubUser = async (token: string) => {
    if (!token) return;
    setIsLoadingUser(true);
    console.log('[Floe:GitHubSyncModal] Verifying GitHub user with token...');
    try {
      const res = await fetch(`/api/github/user?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.authenticated) {
        console.info('[Floe:GitHubSyncModal] Authenticated as:', data.login, data.name);
        setGitHubUser(data);
        if (!selectedOwner || selectedOwner === 'gauravgithub0404') {
          setSelectedOwner(data.login);
        }
      } else {
        console.warn('[Floe:GitHubSyncModal] GitHub token verification returned unauthenticated:', data.error);
      }
    } catch (e) {
      console.warn('[Floe:GitHubModal] Could not fetch user:', e);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const fetchRenderStatus = async () => {
    setIsTestingRender(true);
    console.log('[Floe:GitHubSyncModal] Checking Render Cloud connectivity...');
    try {
      const res = await fetch('/api/render/status');
      const data = await res.json();
      console.info('[Floe:GitHubSyncModal] Render status:', data);
      setRenderStatus({
        connected: Boolean(data.valid || data.apiKeyPresent),
        servicesCount: data.servicesCount || 0,
        postgresCount: data.postgresCount || 0,
        error: data.error
      });
    } catch (err: any) {
      console.warn('[Floe:GitHubSyncModal] Render status check error:', err.message);
      setRenderStatus({
        connected: false,
        error: err.message || 'Could not connect to Render API'
      });
    } finally {
      setIsTestingRender(false);
    }
  };

  const fetchRepoStatus = async () => {
    setIsLoading(true);
    setSyncResult(null);
    console.log('[Floe:GitHubSyncModal] Checking repo status for:', activeTargetRepo);
    try {
      const res = await fetch(`/api/github/status?repo=${encodeURIComponent(activeTargetRepo)}&branch=${encodeURIComponent(targetBranch)}&token=${encodeURIComponent(patToken)}`);
      const data = await res.json();
      console.info('[Floe:GitHubSyncModal] Repo status response:', data);
      setRepoStatus(data);
    } catch (err: any) {
      console.error('[Floe:GitHubSyncModal] Repo status error:', err);
      setRepoStatus({
        connected: false,
        repo: activeTargetRepo,
        branch: targetBranch,
        hasPat: Boolean(patToken),
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.info('[Floe:GitHubSyncModal] Opened modal. Loading stored credentials...');
      // Auto-load saved settings from localStorage
      const savedToken = localStorage.getItem('floe_github_pat') || '';
      const savedCustomer = initialCustomerName || localStorage.getItem('floe_customer_name') || 'Acme Corp';
      const savedAppName = initialAppName || localStorage.getItem('floe_app_name') || 'Finance Invoice Approval';
      const savedOwner = localStorage.getItem('floe_github_owner') || 'gauravgithub0404';
      const savedRepo = localStorage.getItem('floe_github_repo') || '';
      const savedBranch = localStorage.getItem('floe_github_branch') || 'main';
      const savedAutoPush = localStorage.getItem('floe_auto_git_push_enabled') !== 'false';
      const savedMode = (localStorage.getItem('floe_repo_mode') as 'customer_new' | 'existing') || 'customer_new';
      const savedRenderKey = localStorage.getItem('floe_render_api_key') || '';

      if (savedToken) {
        setPatToken(savedToken);
        fetchGitHubUser(savedToken);
      }
      if (savedRenderKey) {
        setRenderApiKey(savedRenderKey);
      }
      setCustomerName(savedCustomer);
      setAppName(savedAppName);
      setSelectedOwner(savedOwner);
      if (savedRepo) setCustomRepoName(savedRepo.includes('/') ? savedRepo.split('/')[1] : savedRepo);
      setTargetBranch(savedBranch);
      setAutoPushEnabled(savedAutoPush);
      setRepoMode(savedMode);
      setCommitMessage(`feat(floe): auto-generate customer application for ${savedCustomer}`);

      fetchRepoStatus();
      fetchRenderStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const [isZipping, setIsZipping] = useState(false);
  const [isDeletingCode, setIsDeletingCode] = useState(false);
  const [isDeletingRepo, setIsDeletingRepo] = useState(false);
  const [deleteCodeResult, setDeleteCodeResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const activeIr = DOMAIN_PRESETS.find(p => p.domain === activeDomain) || LEAVE_MANAGEMENT_IR;
      const blob = await exportAsZip(activeIr);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeIr.domain || 'floe'}-app.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Error creating ZIP:', e);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDeleteCodeFromGit = async () => {
    if (!window.confirm(`Are you sure you want to delete and clean all application code from ${activeTargetRepo} on branch "${targetBranch}"?`)) {
      return;
    }
    setIsDeletingCode(true);
    setDeleteCodeResult(null);
    try {
      const [owner, repo] = activeTargetRepo.split('/');
      const res = await fetch('/api/github/delete-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: owner || selectedOwner,
          repo: repo || activeTargetRepo,
          branch: targetBranch || 'main',
          token: patToken.trim(),
          reason: `Cleaned via Floe App Engine for ${appName}`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteCodeResult({
          success: true,
          message: data.message || `Deleted all code from ${activeTargetRepo} on branch ${targetBranch}.`
        });
        fetchRepoStatus();
      } else {
        setDeleteCodeResult({
          success: false,
          message: data.error || 'Failed to delete code from Git repository.'
        });
      }
    } catch (err: any) {
      setDeleteCodeResult({
        success: false,
        message: err.message || 'Network error while deleting code.'
      });
    } finally {
      setIsDeletingCode(false);
    }
  };

  const handleDeleteRepo = async () => {
    const confirmation = window.prompt(`DANGER: Type "${activeTargetRepo}" to permanently delete this repository from GitHub:`);
    if (confirmation !== activeTargetRepo) {
      return;
    }
    setIsDeletingRepo(true);
    setDeleteCodeResult(null);
    try {
      const [owner, repo] = activeTargetRepo.split('/');
      const res = await fetch('/api/github/repo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: owner || selectedOwner,
          repo: repo || activeTargetRepo,
          token: patToken.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteCodeResult({
          success: true,
          message: `Successfully deleted repository ${activeTargetRepo} from GitHub.`
        });
        fetchRepoStatus();
      } else {
        setDeleteCodeResult({
          success: false,
          message: data.error || 'Failed to delete repository from GitHub. Ensure PAT has "delete_repo" scope.'
        });
      }
    } catch (err: any) {
      setDeleteCodeResult({
        success: false,
        message: err.message || 'Network error while deleting repository.'
      });
    } finally {
      setIsDeletingRepo(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('floe_github_pat', patToken.trim());
    localStorage.setItem('floe_customer_name', customerName.trim());
    localStorage.setItem('floe_github_owner', selectedOwner.trim());
    localStorage.setItem('floe_github_repo', activeTargetRepo);
    localStorage.setItem('floe_github_branch', targetBranch.trim() || 'main');
    localStorage.setItem('floe_auto_git_push_enabled', String(autoPushEnabled));
    localStorage.setItem('floe_repo_mode', repoMode);
    setSavedSettingsSuccess(true);
    setTimeout(() => setSavedSettingsSuccess(false), 2500);
  };

  const handleSyncToGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPushing(true);
    setSyncResult(null);

    try {
      handleSaveSettings();

      const res = await fetch('/api/github/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          appName: appName.trim(),
          owner: selectedOwner.trim(),
          repo: repoMode === 'customer_new' ? computedCustomerRepoName : activeTargetRepo,
          branch: targetBranch.trim() || 'main',
          token: patToken.trim(),
          isPrivate: isPrivate,
          createRepoIfMissing: true,
          commitMessage: commitMessage.trim() || `feat(floe): generate enterprise app for ${customerName}`,
          triggerRenderDeploy: true
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSyncResult({
          success: true,
          message: data.message || `Successfully pushed to ${data.repo}!`,
          repoUrl: data.repoUrl,
          repo: data.repo,
          createdNewRepo: data.createdNewRepo,
          commitSha: data.commitSha,
          deployTriggered: data.deployTriggered
        });
        fetchRepoStatus();
        if (onSuccess) onSuccess();
      } else {
        setSyncResult({
          success: false,
          message: data.error || 'Failed to sync to GitHub. Check repository permissions and PAT token scope.'
        });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Network error while contacting GitHub API.'
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Customer Repository & Auto-Deploy Setup
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-Create Repo Enabled
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Create a dedicated GitHub repo per customer and auto-trigger Render cloud continuous deployments
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Diagnostic Initial Error Alert */}
          {initialError && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-100">Connection / Configuration Notice:</p>
                <p className="text-rose-200/90 leading-relaxed">{initialError}</p>
                <p className="text-[11px] text-rose-300/80">Please verify your GitHub Personal Access Token or cloud settings below to proceed.</p>
              </div>
            </div>
          )}

          {/* Pending Approval Guide Banner */}
          {pendingApproval && !initialError && (
            <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-700/60 text-indigo-200 text-xs flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-white">App Ready to Build & Deploy</p>
                <p className="text-indigo-200 text-[11px] leading-relaxed">
                  Enter or verify your GitHub Token below to auto-create the dedicated customer repo <code className="bg-indigo-900/60 px-1 py-0.5 rounded text-indigo-100">{activeTargetRepo}</code> and start building.
                </p>
              </div>
            </div>
          )}

          {/* PAT Token Configuration & User Banner */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>GitHub Personal Access Token (PAT)</span>
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=Floe+Studio+Customer+Repo+Engine"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <span>Generate Token with `repo` scope</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                value={patToken}
                onChange={(e) => {
                  setPatToken(e.target.value);
                  if (e.target.value.length > 20) {
                    fetchGitHubUser(e.target.value.trim());
                  }
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => fetchGitHubUser(patToken.trim())}
                disabled={isLoadingUser || !patToken.trim()}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingUser ? 'animate-spin' : ''}`} />
                <span>Verify Token</span>
              </button>
            </div>

            {gitHubUser && (
              <div className="flex items-center justify-between text-xs bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-800/40 text-indigo-200">
                <div className="flex items-center gap-2">
                  <img src={gitHubUser.avatar_url} alt={gitHubUser.login} className="w-5 h-5 rounded-full" />
                  <span>Authenticated as <strong className="text-white font-mono">{gitHubUser.login}</strong> ({gitHubUser.name})</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </span>
              </div>
            )}
          </div>

          {/* Customer & Target Account Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Customer / Client Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Customer / Tenant Name</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Acme Corp, FinCorp Global"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-medium"
                required
              />
              <p className="text-[10px] text-slate-500">Used to prefix and isolate the customer's dedicated repository.</p>
            </div>

            {/* Target Account / Org */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>GitHub Owner (User / Org)</span>
              </label>
              {gitHubUser?.orgs && gitHubUser.orgs.length > 0 ? (
                <select
                  value={selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value={gitHubUser.login}>{gitHubUser.login} (Personal Account)</option>
                  {gitHubUser.orgs.map((org) => (
                    <option key={org.login} value={org.login}>{org.login} (Organization)</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value)}
                  placeholder="e.g. gauravgithub0404 or customer-org"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
                  required
                />
              )}
              <p className="text-[10px] text-slate-500">The GitHub user or organization where the repo will be created.</p>
            </div>
          </div>

          {/* Repo Creation Mode Choice */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Repository Provisioning Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRepoMode('customer_new')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  repoMode === 'customer_new'
                    ? 'bg-indigo-950/50 border-indigo-500/60 ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  <FolderGit2 className="w-4 h-4 text-indigo-400" />
                  <span>New Customer Repo (Recommended)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Automatically creates <code className="text-indigo-300 font-mono text-[10px]">{selectedOwner}/{computedCustomerRepoName}</code> on GitHub.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRepoMode('existing')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  repoMode === 'existing'
                    ? 'bg-indigo-950/50 border-indigo-500/60 ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  <GitBranch className="w-4 h-4 text-indigo-400" />
                  <span>Use Existing / Shared Repo</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Push code into an existing repository (e.g. FloeFinal or staging repo).
                </p>
              </button>
            </div>
          </div>

          {/* Target Repo Slug Customizer & Live GitHub URL Preview */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Target Repository Name</span>
                <span className="text-[10px] text-indigo-400 font-mono">Branch: {targetBranch}</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono select-none">{selectedOwner} /</span>
                <input
                  type="text"
                  value={repoMode === 'customer_new' ? (customRepoName || computedCustomerRepoName) : customRepoName}
                  onChange={(e) => setCustomRepoName(e.target.value)}
                  placeholder={computedCustomerRepoName}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-indigo-300 font-mono font-bold focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Live Target URL Preview */}
            <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400">Target GitHub URL:</span>
                <a
                  href={`https://github.com/${activeTargetRepo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline font-mono font-semibold flex items-center gap-1"
                >
                  <span>https://github.com/{activeTargetRepo}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>Render Auto-Deploy</span>
              </div>
            </div>
          </div>

          {/* Render Cloud Deployment Configuration */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Render Cloud Configuration & API Key</span>
              </label>
              <button
                type="button"
                onClick={fetchRenderStatus}
                disabled={isTestingRender}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isTestingRender ? 'animate-spin' : ''}`} />
                <span>Test Render Connection</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                value={renderApiKey}
                onChange={(e) => {
                  setRenderApiKey(e.target.value);
                  localStorage.setItem('floe_render_api_key', e.target.value.trim());
                }}
                placeholder="rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (Optional if configured in environment)"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
            </div>

            {renderStatus && (
              <div className={`flex items-center justify-between text-xs p-2.5 rounded-lg border ${
                renderStatus.connected 
                  ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-800/40 text-amber-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${renderStatus.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>
                    {renderStatus.connected
                      ? `Render Cloud Connected (${renderStatus.servicesCount || 0} active web services, ${renderStatus.postgresCount || 0} databases)`
                      : (renderStatus.error || 'Render API key not detected or limited access.')}
                  </span>
                </div>
                <span className={`text-[10px] font-bold ${renderStatus.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {renderStatus.connected ? 'Ready for Auto-Deploy' : 'Optional'}
                </span>
              </div>
            )}
          </div>

          {/* Download ZIP Banner */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <FolderArchive className="w-4 h-4 text-indigo-400" />
                <span>Download Generated Application Source</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Download a clean standalone .ZIP bundle with all backend routes, SQL migrations, client UI, and docs.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shrink-0 disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${isZipping ? 'animate-bounce' : ''}`} />
              <span>{isZipping ? 'Zipping...' : 'Download (.ZIP)'}</span>
            </button>
          </div>

          {/* Delete Code from Git & Repository Danger Zone */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Git Code Deletion & Cleanup</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                Danger Zone
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Clean and remove all application code from target branch <code className="text-rose-300 font-mono">{targetBranch}</code> or permanently delete this repository on GitHub.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDeleteCodeFromGit}
                disabled={isDeletingCode || !patToken.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/70 border border-rose-700/60 text-rose-200 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeletingCode ? 'animate-spin' : ''}`} />
                <span>{isDeletingCode ? 'Cleaning Code...' : 'Delete Code from Git Branch'}</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteRepo}
                disabled={isDeletingRepo || !patToken.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${isDeletingRepo ? 'animate-spin' : ''}`} />
                <span>{isDeletingRepo ? 'Deleting Repo...' : 'Delete Repository from GitHub'}</span>
              </button>
            </div>

            {deleteCodeResult && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                deleteCodeResult.success 
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' 
                  : 'bg-rose-950/50 border-rose-800 text-rose-300'
              }`}>
                {deleteCodeResult.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{deleteCodeResult.message}</span>
              </div>
            )}
          </div>

          {/* Sync Result Feedback */}
          {syncResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
              syncResult.success 
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
            }`}>
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <p className="font-bold">{syncResult.message}</p>
                {syncResult.success && syncResult.repoUrl && (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <a
                      href={syncResult.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-white bg-emerald-700/50 hover:bg-emerald-700 px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>Open {syncResult.repo} on GitHub</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {savedSettingsSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Customer repository settings saved! Future builds will automatically push to <strong>{activeTargetRepo}</strong>.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Save Configuration
          </button>

          <button
            type="button"
            onClick={handleSyncToGitHub}
            disabled={isPushing || !patToken.trim()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
          >
            {isPushing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Creating Repo & Pushing Code...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Create Customer Repo & Push Now</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
