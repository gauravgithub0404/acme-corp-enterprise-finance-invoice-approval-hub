import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Github, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  FileCode, 
  Key, 
  Lock, 
  ExternalLink,
  ShieldAlert,
  GitBranch,
  FolderArchive,
  Terminal
} from 'lucide-react';
import { IntermediateRepresentation } from '../types/floe';
import { exportAsZip } from '../engine/codegenEngine';
import { LEAVE_MANAGEMENT_IR, DOMAIN_PRESETS } from '../data/domains';

interface DeleteGitCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  ir?: IntermediateRepresentation;
  activeDomain?: string;
  activeAppName?: string;
  onSuccess?: () => void;
}

export const DeleteGitCodeModal: React.FC<DeleteGitCodeModalProps> = ({
  isOpen,
  onClose,
  ir,
  activeDomain = 'finance-invoice-approval',
  activeAppName = 'Generated Application',
  onSuccess
}) => {
  const [selectedAction, setSelectedAction] = useState<'clean_code' | 'delete_repo'>('clean_code');
  const [githubRepo, setGithubRepo] = useState<string>('gauravgithub0404/FloeFinal');
  const [githubBranch, setGithubBranch] = useState<string>('main');
  const [patToken, setPatToken] = useState<string>('');
  const [confirmRepoText, setConfirmRepoText] = useState<string>('');
  
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Active IR resolution
  const activeIr: IntermediateRepresentation = ir || DOMAIN_PRESETS.find(p => p.domain === activeDomain) || LEAVE_MANAGEMENT_IR;

  useEffect(() => {
    if (isOpen) {
      const savedPat = localStorage.getItem('floe_github_pat') || '';
      const savedRepo = localStorage.getItem('floe_github_repo') || 'gauravgithub0404/FloeFinal';
      const savedBranch = localStorage.getItem('floe_github_branch') || 'main';

      setPatToken(savedPat);
      setGithubRepo(savedRepo.includes('/') ? savedRepo : `gauravgithub0404/${savedRepo || 'FloeFinal'}`);
      setGithubBranch(savedBranch);
      setConfirmRepoText('');
      setResult(null);
      setLogs([
        `[Ready] Target Git Repository: ${savedRepo || 'gauravgithub0404/FloeFinal'}`,
        `[Ready] Target Branch: ${savedBranch}`,
        `[Ready] Active App: ${activeAppName} (${activeDomain})`
      ]);
    }
  }, [isOpen, activeDomain, activeAppName]);

  if (!isOpen) return null;

  const targetRepoNameOnly = githubRepo.split('/').pop() || 'FloeFinal';
  const isRepoConfirmed = confirmRepoText.trim().toLowerCase() === githubRepo.toLowerCase() || confirmRepoText.trim().toLowerCase() === targetRepoNameOnly.toLowerCase();

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      setLogs(prev => [...prev, `[ZIP] Packing all source artifacts, DDL migrations, and docs for "${activeIr.name}"...`]);
      
      const blob = await exportAsZip(activeIr);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeIr.domain || activeDomain}-floe-app.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLogs(prev => [
        ...prev,
        `[ZIP Success] Downloaded ${activeIr.domain}-floe-app.zip (${(blob.size / 1024).toFixed(1)} KB)`
      ]);
    } catch (err: any) {
      console.error('Error exporting zip:', err);
      setLogs(prev => [...prev, `[ZIP Error] Failed to generate zip: ${err.message}`]);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDeleteFromGit = async () => {
    if (!patToken.trim()) {
      setResult({
        success: false,
        message: 'GitHub Personal Access Token (PAT) is required to perform Git modifications or deletions.'
      });
      return;
    }

    if (selectedAction === 'delete_repo' && !isRepoConfirmed) {
      setResult({
        success: false,
        message: `Please type "${githubRepo}" to confirm deleting the repository.`
      });
      return;
    }

    setIsDeleting(true);
    setResult(null);

    const [owner, repo] = githubRepo.split('/');

    try {
      if (selectedAction === 'clean_code') {
        setLogs(prev => [
          ...prev,
          `[Git Delete 1/2] Removing all application code files from ${githubRepo} (${githubBranch})...`
        ]);

        const res = await fetch('/api/github/delete-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: owner || 'gauravgithub0404',
            repo: repo || 'FloeFinal',
            branch: githubBranch,
            token: patToken.trim(),
            reason: `Cleaned for domain ${activeDomain}`
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setResult({
            success: true,
            message: data.message || `Deleted all code from ${githubRepo} on branch ${githubBranch}.`
          });
          setLogs(prev => [
            ...prev,
            `[Git Delete 2/2] Success! All code removed from repository branch. Commit SHA: ${data.commitSha?.slice(0, 7)}`
          ]);
          if (onSuccess) onSuccess();
        } else {
          setResult({
            success: false,
            message: data.error || 'Failed to delete code from GitHub'
          });
          setLogs(prev => [...prev, `[Git Error] ${data.error || 'Failed to delete code'}`]);
        }
      } else {
        // Delete entire repository
        setLogs(prev => [
          ...prev,
          `[Git Delete 1/2] Requesting permanent deletion of repository "${githubRepo}" on GitHub...`
        ]);

        const res = await fetch('/api/github/repo', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: owner || 'gauravgithub0404',
            repo: repo || 'FloeFinal',
            token: patToken.trim()
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setResult({
            success: true,
            message: data.message || `Deleted repository ${githubRepo} permanently.`
          });
          setLogs(prev => [
            ...prev,
            `[Git Delete 2/2] Repository "${githubRepo}" deleted permanently from GitHub!`
          ]);
          if (onSuccess) onSuccess();
        } else {
          setResult({
            success: false,
            message: data.error || 'Failed to delete repository from GitHub'
          });
          setLogs(prev => [...prev, `[Git Error] ${data.error || 'Deletion rejected'}`]);
        }
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Network error while contacting GitHub API'
      });
      setLogs(prev => [...prev, `[Fatal] Network error: ${err.message}`]);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Git Code Management & ZIP Export
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  Code Lifecycle
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Download generated app as a standalone ZIP or delete/clean code from GitHub
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

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Quick ZIP Export Banner */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <FolderArchive className="w-4 h-4 text-indigo-400" />
                <span>Download Generated Application (.ZIP)</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Export complete source code: Node.js server, PostgreSQL DDL migrations, client UI, Docker compose, and architecture docs.
              </p>
            </div>

            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/20 shrink-0"
            >
              <Download className={`w-3.5 h-3.5 ${isZipping ? 'animate-bounce' : ''}`} />
              <span>{isZipping ? 'Creating ZIP...' : 'Download as ZIP'}</span>
            </button>
          </div>

          {/* Action Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Choose Git Cleanup Action:
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedAction('clean_code')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  selectedAction === 'clean_code'
                    ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Clean / Delete Code from Branch</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Deletes all application files from branch <code className="text-rose-300 font-mono text-[10px]">{githubBranch}</code>, keeping the repository ready for clean new builds.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('delete_repo')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  selectedAction === 'delete_repo'
                    ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>Delete Entire Repository</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Permanently deletes the repository <code className="text-rose-300 font-mono text-[10px]">{githubRepo}</code> from your GitHub account.
                </p>
              </button>
            </div>
          </div>

          {/* GitHub Credentials & Target Info */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Github className="w-3 h-3 text-slate-400" /> Target Repository
                </label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={e => setGithubRepo(e.target.value)}
                  placeholder="owner/repository"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3 text-indigo-400" /> Target Branch
                </label>
                <input
                  type="text"
                  value={githubBranch}
                  onChange={e => setGithubBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-amber-400" /> GitHub Personal Access Token (PAT)
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,delete_repo&description=Floe+Git+Manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Generate Token <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                value={patToken}
                onChange={e => {
                  setPatToken(e.target.value);
                  localStorage.setItem('floe_github_pat', e.target.value.trim());
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Permanent Deletion Safety Confirmation */}
            {selectedAction === 'delete_repo' && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Confirm Permanent Deletion</span>
                </div>
                <p className="text-[11px] text-rose-200/80">
                  Please type <strong className="text-white font-mono">{githubRepo}</strong> to confirm deleting the repository permanently.
                </p>
                <input
                  type="text"
                  value={confirmRepoText}
                  onChange={e => setConfirmRepoText(e.target.value)}
                  placeholder={`Type "${githubRepo}" here`}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-rose-700/80 text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                />
              </div>
            )}
          </div>

          {/* Feedback Result */}
          {result && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              result.success 
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}>
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">{result.message}</p>
              </div>
            </div>
          )}

          {/* Execution Terminal Logs */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 font-mono text-[11px] text-slate-300 space-y-1.5 max-h-32 overflow-y-auto">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80 text-slate-400 text-[10px]">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>Git & ZIP Export Console</span>
            </div>
            {logs.map((l, idx) => (
              <div key={idx} className={`leading-relaxed ${l.includes('[Error]') || l.includes('[Fatal]') ? 'text-rose-400' : l.includes('[Success]') || l.includes('[ZIP Success]') ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                {l}
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </button>

            <button
              onClick={handleDeleteFromGit}
              disabled={isDeleting || (selectedAction === 'delete_repo' && !isRepoConfirmed)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
              <span>
                {isDeleting 
                  ? 'Deleting from Git...' 
                  : selectedAction === 'delete_repo' 
                    ? 'Delete Entire Repository' 
                    : 'Delete Code from Git'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
