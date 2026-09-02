import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  Terminal, 
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
  HardDrive,
  Globe,
  Plus,
  Github,
  GitBranch,
  UploadCloud,
  Key,
  Lock,
  Download,
  FolderArchive,
  AlertTriangle
} from 'lucide-react';
import { exportAsZip } from '../engine/codegenEngine';
import { LEAVE_MANAGEMENT_IR, DOMAIN_PRESETS } from '../data/domains';
import { getPublicTestbedUrl, getCurrentOrigin } from '../utils/urlHelper';

interface CleanRenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDomain?: string;
  activeAppName?: string;
}

export const CleanRenderModal: React.FC<CleanRenderModalProps> = ({
  isOpen,
  onClose,
  activeDomain = 'finance-invoice-approval',
  activeAppName = 'Generated Application'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPushingGit, setIsPushingGit] = useState(false);
  const [isDeletingService, setIsDeletingService] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [deleteOtherServices, setDeleteOtherServices] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [result, setResult] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [customDomain, setCustomDomain] = useState<string>(activeDomain);

  // GitHub State
  const [patToken, setPatToken] = useState<string>('');
  const [githubRepo, setGithubRepo] = useState<string>('gauravgithub0404/FloeFinal');
  const [githubBranch, setGithubBranch] = useState<string>('main');
  const [githubStatus, setGithubStatus] = useState<any | null>(null);
  const [isLoadingGitStatus, setIsLoadingGitStatus] = useState<boolean>(false);
  const [showGitPatInput, setShowGitPatInput] = useState<boolean>(false);

  useEffect(() => {
    setCustomDomain(activeDomain);
  }, [activeDomain]);

  const fetchGithubStatus = async (token?: string) => {
    setIsLoadingGitStatus(true);
    try {
      const activePat = token !== undefined ? token : patToken;
      const res = await fetch(`/api/github/status?repo=${encodeURIComponent(githubRepo)}&branch=${encodeURIComponent(githubBranch)}&token=${encodeURIComponent(activePat)}`);
      const data = await res.json();
      setGithubStatus(data);
    } catch (err: any) {
      console.warn('Failed to load GitHub status:', err);
    } finally {
      setIsLoadingGitStatus(false);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/render/services');
      if (res.ok) {
        const data = await res.json();
        const sList = data.services || [];
        setServices(sList);
        if (sList.length > 0 && !selectedServiceId) {
          const matched = sList.find((s: any) => 
            s.name?.toLowerCase().includes(activeDomain.toLowerCase()) ||
            s.name?.toLowerCase().includes('floefinal') ||
            s.name?.toLowerCase().includes('floe')
          ) || sList[0];
          setSelectedServiceId(matched.id);
        }
      }
    } catch (err) {
      console.warn('Failed to load Render services:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const savedPat = localStorage.getItem('floe_github_pat') || '';
      const savedRepo = localStorage.getItem('floe_github_repo') || 'gauravgithub0404/FloeFinal';
      const savedBranch = localStorage.getItem('floe_github_branch') || 'main';

      setPatToken(savedPat);
      setGithubRepo(savedRepo.includes('/') ? savedRepo : `gauravgithub0404/${savedRepo || 'FloeFinal'}`);
      setGithubBranch(savedBranch);

      fetchServices();
      fetchGithubStatus(savedPat);
      setResult(null);
      setLogs([
        `[Ready] Selected Domain: ${activeDomain}`,
        `[Ready] App Name: ${activeAppName}`,
        `[Tip] Render builds directly from GitHub repo "${savedRepo || 'gauravgithub0404/FloeFinal'}". Push code before clean deploying.`
      ]);
    }
  }, [isOpen, activeDomain]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSavePat = () => {
    if (patToken.trim()) {
      localStorage.setItem('floe_github_pat', patToken.trim());
      fetchGithubStatus(patToken.trim());
      setShowGitPatInput(false);
      setLogs(prev => [...prev, `[GitHub] Personal Access Token saved.`]);
    }
  };

  const handlePushToGithub = async (): Promise<boolean> => {
    setIsPushingGit(true);
    setLogs(prev => [
      ...prev,
      `[GitHub 1/2] Syncing all workspace files to GitHub repo "${githubRepo}" (${githubBranch})...`
    ]);

    try {
      const res = await fetch('/api/github/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Enterprise',
          appName: activeAppName,
          owner: githubRepo.split('/')[0] || 'gauravgithub0404',
          repo: githubRepo.split('/')[1] || 'FloeFinal',
          branch: githubBranch,
          token: patToken.trim(),
          commitMessage: `feat(floe): update all components & domains for ${activeAppName} [${customDomain}]`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(prev => [
          ...prev,
          `[GitHub 2/2] Pushed all workspace files successfully! Commit SHA: ${data.commitSha?.slice(0, 7) || 'latest'}`,
          `[GitHub] GitHub repo is now 100% updated with all components and code.`
        ]);
        fetchGithubStatus(patToken);
        return true;
      } else {
        const errMsg = data.error || 'Failed to push to GitHub';
        setLogs(prev => [
          ...prev,
          `[GitHub Error] ${errMsg}`,
          `[Tip] If permissions are required, provide a GitHub Personal Access Token with "repo" scope.`
        ]);
        setShowGitPatInput(true);
        return false;
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[GitHub Fatal] Network error during Git push: ${err.message}`]);
      return false;
    } finally {
      setIsPushingGit(false);
    }
  };

  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${serviceName}" from Render? This will delete the deployed web app on Render.`)) {
      return;
    }

    setIsDeletingService(serviceId);
    setLogs(prev => [...prev, `[Delete] Requesting deletion of service "${serviceName}" (ID: ${serviceId}) on Render...`]);

    try {
      const res = await fetch(`/api/render/services/${encodeURIComponent(serviceId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setLogs(prev => [...prev, `[Deleted] Successfully deleted service "${serviceName}" from Render.`]);
        await fetchServices();
        if (selectedServiceId === serviceId) {
          setSelectedServiceId('');
        }
      } else {
        setLogs(prev => [...prev, `[Error] Failed to delete service: ${data.error || 'Unknown error'}`]);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[Fatal] Network error while deleting service: ${err.message}`]);
    } finally {
      setIsDeletingService(null);
    }
  };

  const handleCleanRedeploy = async (shouldPushGitFirst: boolean = false) => {
    setIsLoading(true);

    if (shouldPushGitFirst) {
      const pushSuccess = await handlePushToGithub();
      if (!pushSuccess) {
        setLogs(prev => [...prev, `[Warning] GitHub sync had issues. Proceeding to trigger Render redeploy...`]);
      }
    }

    setLogs(prev => [
      ...prev,
      `[1/4] Initiating Render cache purge for domain "${customDomain}"...`,
      `[2/4] Updating Render environment variables (FLOE_APP_DOMAIN=${customDomain})...`
    ]);

    try {
      await fetch('/api/deployed-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: customDomain,
          appName: activeAppName
        })
      }).catch(() => {});

      const res = await fetch('/api/render/clean-redeploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: customDomain,
          appName: activeAppName,
          serviceId: selectedServiceId || undefined,
          clearCache: true,
          deleteOtherServices
        })
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        if (data.deletedServices && data.deletedServices.length > 0) {
          setLogs(prev => [
            ...prev,
            `[Cleanup] Deleted obsolete Render services: ${data.deletedServices.join(', ')}`
          ]);
        }
        setLogs(prev => [
          ...prev,
          `[3/4] Render build cache purged successfully!`,
          `[4/4] Triggered clean deployment on service "${data.serviceName || 'Render Service'}" (Deploy ID: ${data.deployId || 'active'}).`,
          `[Done] Ready! Render is now building your latest commit clean without stale cache.`
        ]);
        fetchServices();
      } else {
        setLogs(prev => [
          ...prev,
          `[Error] ${data.error || 'Failed to trigger clean deployment on Render'}`
        ]);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[Fatal] Network error: ${err.message}`]);
      setResult({ success: false, error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedService = services.find(s => s.id === selectedServiceId);
  const serviceUrl = selectedService?.serviceDetails?.url || (selectedService?.name ? `https://${selectedService.name}.onrender.com` : 'https://floefinal.onrender.com');
  const directAppUrl = `${serviceUrl}/?app=${encodeURIComponent(customDomain)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Clean Render & Deployed Apps
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Cache Purge & Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Push latest code to GitHub, purge Render build cache, and force clean deployment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* GitHub Sync Status Card */}
          <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Github className="w-4 h-4 text-white" />
                <span>Connected GitHub Repository:</span>
                <a 
                  href={`https://github.com/${githubRepo}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-indigo-400 hover:underline font-mono text-[11px]"
                >
                  {githubRepo}
                </a>
              </div>
              <button
                onClick={() => setShowGitPatInput(!showGitPatInput)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <Key className="w-3 h-3" /> {patToken ? 'Edit Token' : 'Add Token'}
              </button>
            </div>

            {/* Last Commit Info */}
            <div className="flex items-center justify-between text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                <span>Branch: <strong className="text-slate-200">{githubBranch}</strong></span>
                {githubStatus?.lastCommit && (
                  <span className="text-slate-500 font-mono">
                    (Last Commit: {githubStatus.lastCommit.sha?.slice(0, 7)})
                  </span>
                )}
              </div>

              <button
                onClick={() => handlePushToGithub()}
                disabled={isPushingGit}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isPushingGit ? 'animate-bounce' : ''}`} />
                <span>{isPushingGit ? 'Pushing...' : 'Push Latest Code to GitHub'}</span>
              </button>
            </div>

            {/* PAT Input if toggled */}
            {showGitPatInput && (
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between text-indigo-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> GitHub Personal Access Token (PAT)
                  </span>
                  <a 
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Floe+Deploy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    Generate Token <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={patToken}
                    onChange={e => setPatToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 px-3 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSavePat}
                    className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Domain & Deployment Settings */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Active App Domain to Clean & Deploy:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={customDomain}
                onChange={e => setCustomDomain(e.target.value)}
                placeholder="e.g. finance-invoice-approval"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>App Name: <strong className="text-slate-200">{activeAppName}</strong></span>
              </div>
            </div>
          </div>

          {/* Delete Obsolete Services Checkbox */}
          {services.length > 1 && (
            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-red-950/20 border border-red-900/30 text-xs text-red-300 cursor-pointer hover:bg-red-950/30 transition-colors">
              <input 
                type="checkbox"
                checked={deleteOtherServices}
                onChange={e => setDeleteOtherServices(e.target.checked)}
                className="rounded border-slate-700 text-red-600 focus:ring-red-500 bg-slate-950"
              />
              <span>Also delete other older Render services in this account (leaves only target service)</span>
            </label>
          )}

          {/* Deployed Render Services List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                Deployed Services on Render ({services.length}):
              </span>
              <button
                onClick={fetchServices}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {services.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500 text-xs text-center">
                  No active Render Web Services detected or Render API key not configured.
                </div>
              ) : (
                services.map(s => {
                  const isCurrentTarget = s.id === selectedServiceId;
                  const sUrl = s.serviceDetails?.url || `https://${s.name}.onrender.com`;
                  return (
                    <div 
                      key={s.id} 
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all ${
                        isCurrentTarget 
                          ? 'bg-indigo-950/30 border-indigo-500/50 text-slate-200' 
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">{s.name}</span>
                          {isCurrentTarget && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase">
                              Active Target
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">
                            {s.serviceDetails?.region || 'oregon'}
                          </span>
                        </div>
                        <a 
                          href={sUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[11px] text-indigo-400 hover:underline truncate block"
                        >
                          {sUrl}
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setSelectedServiceId(s.id)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            isCurrentTarget 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {isCurrentTarget ? 'Selected' : 'Select'}
                        </button>

                        <button
                          onClick={() => handleDeleteService(s.id, s.name)}
                          disabled={isDeletingService === s.id}
                          className="p-1.5 rounded bg-red-950/60 hover:bg-red-900 text-red-400 hover:text-red-200 border border-red-800/40 transition-colors disabled:opacity-50"
                          title="Delete app from Render"
                        >
                          {isDeletingService === s.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Direct URL Preview */}
          <div className="p-3.5 bg-indigo-950/40 rounded-xl border border-indigo-800/50 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-indigo-400" />
                Direct Multi-Domain URL on Render:
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 font-mono">
                Always Loads {customDomain}
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300">
              <span className="truncate">{directAppUrl}</span>
              <button
                onClick={() => handleCopy(directAppUrl, 'direct')}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                title="Copy Direct URL"
              >
                {copiedKey === 'direct' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Execution Terminal Logs */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 font-mono text-[11px] text-slate-300 space-y-1.5 max-h-36 overflow-y-auto">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80 text-slate-400 text-[10px]">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>Render Clean & Redeploy Console</span>
            </div>
            {logs.map((l, idx) => (
              <div key={idx} className={`leading-relaxed ${l.includes('[Error]') || l.includes('[Fatal]') ? 'text-red-400' : l.includes('[Done]') || l.includes('[Deleted]') ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {l}
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCleanRedeploy(true)}
              disabled={isLoading || isPushingGit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              title="Push all files to GitHub first, then trigger clean Render build"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${isPushingGit ? 'animate-bounce' : ''}`} />
              <span>{isPushingGit ? 'Syncing to GitHub...' : 'Sync to GitHub & Clean Redeploy'}</span>
            </button>

            <button
              onClick={() => handleCleanRedeploy(false)}
              disabled={isLoading || isPushingGit}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Deploying...' : 'Clean Cache & Redeploy'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
