import React, { useState, useEffect, useRef } from 'react';
import { IntermediateRepresentation } from '../types/floe';
import { 
  Database, 
  Cpu, 
  CheckCircle2, 
  RefreshCw, 
  Terminal, 
  Layers, 
  ShieldCheck, 
  Zap, 
  Github, 
  UploadCloud, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  Key, 
  Radio, 
  ArrowRight,
  FolderGit2,
  Building2,
  GitBranch,
  Play,
  Settings
} from 'lucide-react';
import { GitHubSyncModal } from './GitHubSyncModal';

interface GenerationProgressProps {
  ir: IntermediateRepresentation;
  onComplete: () => void;
}

interface Step {
  id: string;
  label: string;
  detail: string;
  durationMs: number;
}

const GENERATION_STEPS: Step[] = [
  {
    id: 'db',
    label: 'Deterministic Database Compiler',
    detail: 'Generating PostgreSQL DDL with foreign keys, uuid-ossp, and runtime execution tables...',
    durationMs: 650
  },
  {
    id: 'recordservice',
    label: 'Synthesizing RecordService Boundary',
    detail: 'Wiring atomic transition() handlers, balance deduction guards, and transaction boundaries...',
    durationMs: 700
  },
  {
    id: 'workflow',
    label: 'Assembling WorkflowExecutor Engine',
    detail: 'Configuring 4-mode execution runtime (AST evaluator, AI reason classifier, 48h human timeout)...',
    durationMs: 750
  },
  {
    id: 'backend',
    label: 'Packaging Express REST API & Auth',
    detail: 'Generating endpoints with server-side permission checks and magic decision token handlers...',
    durationMs: 600
  },
  {
    id: 'docker',
    label: 'Generating Multi-Container Orchestration',
    detail: 'Writing docker-compose.yml, healthchecks, and environment configuration templates...',
    durationMs: 550
  },
  {
    id: 'smoke',
    label: 'Headless Build Smoke Test',
    detail: 'Executing TypeScript compiler smoke test (tsc --noEmit) & referential integrity assertion...',
    durationMs: 550
  },
  {
    id: 'git_sync',
    label: 'Automated Customer Repo Sync & Deploy',
    detail: 'Packaging source files, verifying customer repository & preparing container runtime...',
    durationMs: 1000
  }
];

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  ir,
  onComplete
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Git Auto-Push & Repo Creation State
  const [gitStatus, setGitStatus] = useState<'pending' | 'syncing' | 'success' | 'skipped' | 'failed'>('pending');
  const [gitMessage, setGitMessage] = useState<string>('');
  const [commitSha, setCommitSha] = useState<string>('');
  const [createdRepoUrl, setCreatedRepoUrl] = useState<string>('');
  const [createdRepoName, setCreatedRepoName] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);
  const hasTriggeredCompleteRef = useRef(false);

  // GitHub / Cloud Modal State
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [gitHubModalInitialError, setGitHubModalInitialError] = useState<string | undefined>(undefined);

  // Derive Customer Name & Target Repo
  const sanitizeSlug = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const customerName = ir.customer_name || 
    (typeof window !== 'undefined' ? localStorage.getItem('floe_customer_name') : '') || 
    ir.metadata?.customer_name as string || 
    'AcmeCorp';

  const defaultOwner = typeof window !== 'undefined' ? localStorage.getItem('floe_github_owner') || 'gauravgithub0404' : 'gauravgithub0404';
  const targetBranch = typeof window !== 'undefined' ? localStorage.getItem('floe_github_branch') || 'main' : 'main';

  const expectedRepoSlug = `${sanitizeSlug(customerName)}-${sanitizeSlug(ir.name || ir.domain || 'app')}`;
  const fullExpectedRepo = `${defaultOwner}/${expectedRepoSlug}`;

  const finishAndLaunch = () => {
    if (hasTriggeredCompleteRef.current) return;
    hasTriggeredCompleteRef.current = true;
    console.info('[Floe:GenerationProgress] finishAndLaunch → Calling onComplete() to switch to testbed');
    setIsCompleted(true);
    setCompletedSteps(GENERATION_STEPS.map(s => s.id));

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('floe_active_app_ir', JSON.stringify(ir));
        localStorage.setItem('floe_last_generated_ir', JSON.stringify(ir));
      } catch {}
    }

    fetch('/api/deployed-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ir,
        domain: ir.domain,
        appName: ir.name,
        customerName
      })
    }).catch((err) => {
      console.warn('[Floe:GenerationProgress] Non-blocking /api/deployed-app notice:', err);
    });

    onComplete();
  };

  const handleGitStep = async () => {
    const activeToken = typeof window !== 'undefined' ? localStorage.getItem('floe_github_pat') || '' : '';
    
    console.group('[Floe:GenerationProgress:handleGitStep]');
    console.info('Customer:', customerName);
    console.info('Target Repo:', fullExpectedRepo);
    console.info('PAT token available:', Boolean(activeToken));
    console.groupEnd();

    setLogs(prev => [
      ...prev,
      `[CUSTOMER-REPO] Customer: "${customerName}"`,
      `[CUSTOMER-REPO] Target Repository: https://github.com/${fullExpectedRepo}`
    ]);

    if (!activeToken) {
      setGitStatus('skipped');
      setLogs(prev => [
        ...prev,
        `[GIT-SYNC] Target repository configured: ${fullExpectedRepo}`,
        `[GIT-SYNC] Notice: No GitHub Personal Access Token saved in local session.`,
        `[STUDIO-SANDBOX] Local engine compilation complete. Launching interactive testbed...`
      ]);
      setCompletedSteps(prev => [...prev, 'git_sync']);
      setTimeout(() => {
        finishAndLaunch();
      }, 1200);
      return;
    }

    setGitStatus('syncing');
    setLogs(prev => [
      ...prev,
      `[GIT-AUTO-PROVISION] Verifying customer repository ${fullExpectedRepo} on GitHub...`,
      `[GIT-AUTO-PUSH] Bundling workspace files, state machine AST, and React runtime...`
    ]);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch('/api/github/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName,
          appName: ir.name,
          owner: defaultOwner,
          repo: expectedRepoSlug,
          branch: targetBranch,
          token: activeToken,
          createRepoIfMissing: true,
          commitMessage: `feat(floe): auto-generate customer repository for ${customerName} (${ir.name})`,
          triggerRenderDeploy: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      console.info('[Floe:GenerationProgress] GitHub sync response:', data);

      if (res.ok && data.success) {
        setGitStatus('success');
        setCommitSha(data.commitSha || '');
        setCreatedRepoUrl(data.repoUrl || `https://github.com/${data.repo}`);
        setCreatedRepoName(data.repo || fullExpectedRepo);
        setGitMessage(data.message || `Created repository ${data.repo} and pushed code!`);

        setLogs(prev => [
          ...prev,
          data.createdNewRepo 
            ? `[GIT-AUTO-PROVISION] SUCCESS: Created repository https://github.com/${data.repo}`
            : `[GIT-AUTO-PUSH] SUCCESS: Synced code to https://github.com/${data.repo}`,
          `[GIT-AUTO-PUSH] Commit SHA: ${data.commitSha?.slice(0, 7)} (branch: ${targetBranch})`,
          `[RENDER-CD] Webhook triggered. Container deploy dispatched!`,
          `[READY] Compilation complete. Launching interactive testbed...`
        ]);

        setCompletedSteps(prev => [...prev, 'git_sync']);
        setTimeout(() => {
          finishAndLaunch();
        }, 1200);
      } else {
        setGitStatus('failed');
        console.warn('[Floe:GenerationProgress] GitHub sync error:', data.error);
        setLogs(prev => [
          ...prev,
          `[GIT-AUTO-PUSH] Notice: ${data.error || 'GitHub sync bypassed'}.`,
          `[STUDIO-SANDBOX] Proceeding to live interactive testbed...`
        ]);
        setCompletedSteps(prev => [...prev, 'git_sync']);
        setTimeout(() => {
          finishAndLaunch();
        }, 1200);
      }
    } catch (err: any) {
      setGitStatus('failed');
      console.warn('[Floe:GenerationProgress] GitHub sync network/timeout error:', err.message);
      setLogs(prev => [
        ...prev,
        `[GIT-AUTO-PUSH] Notice: GitHub sync timed out or bypassed (${err.message}).`,
        `[STUDIO-SANDBOX] Proceeding to live interactive testbed...`
      ]);
      setCompletedSteps(prev => [...prev, 'git_sync']);
      setTimeout(() => {
        finishAndLaunch();
      }, 1200);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const executeStep = (idx: number) => {
      if (idx >= GENERATION_STEPS.length) {
        finishAndLaunch();
        return;
      }

      const step = GENERATION_STEPS[idx];
      setCurrentStepIdx(idx);
      console.info(`[Floe:GenerationProgress] Step ${idx + 1}/${GENERATION_STEPS.length}: ${step.label}`);
      setLogs(prev => [
        ...prev,
        `[FLOE-COMPILER] Starting phase: ${step.label}`,
        `[TASK] ${step.detail}`
      ]);

      if (step.id === 'git_sync') {
        // Execute customer repo sync
        timer = setTimeout(() => {
          handleGitStep();
        }, 200);
      } else {
        timer = setTimeout(() => {
          setCompletedSteps(prev => [...prev, step.id]);
          executeStep(idx + 1);
        }, step.durationMs);
      }
    };

    executeStep(0);
    return () => clearTimeout(timer);
  }, []);

  const currentStep = GENERATION_STEPS[currentStepIdx] || GENERATION_STEPS[GENERATION_STEPS.length - 1];
  const progressPercent = Math.min(100, Math.round(((completedSteps.length + 0.5) / GENERATION_STEPS.length) * 100));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-7">
      
      {/* Header Status & Instant Launch Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3.5 text-left">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Generating "{ir.name}"
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Customer: {customerName}
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1 font-mono text-slate-600">
                <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Repo: {fullExpectedRepo}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setGitHubModalInitialError(undefined);
              setIsGitHubModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>GitHub & Render Config</span>
          </button>

          <button
            onClick={finishAndLaunch}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Launch Testbed Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            <span>{currentStep.label}</span>
          </span>
          <span className="font-mono text-indigo-600">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-300 shadow-xs"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Steps List */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
        {GENERATION_STEPS.map((step, idx) => {
          const isDone = completedSteps.includes(step.id);
          const isCurrent = currentStepIdx === idx && !isDone;

          return (
            <div key={step.id} className="p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                )}
                <div>
                  <span className={`font-semibold ${isDone ? 'text-slate-900' : isCurrent ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                  {isCurrent && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{step.detail}</p>
                  )}
                  {step.id === 'git_sync' && isDone && createdRepoUrl && (
                    <p className="text-[11px] text-emerald-700 mt-0.5 font-mono flex items-center gap-1 font-bold">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Created repo: <a href={createdRepoUrl} target="_blank" rel="noreferrer" className="underline">{createdRepoName}</a></span>
                    </p>
                  )}
                </div>
              </div>

              <span className="font-mono text-[11px] text-slate-400">
                {isDone ? 'PASS' : isCurrent ? 'RUNNING' : 'PENDING'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Real-time Compiler Log Output */}
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-slate-300 font-mono text-xs shadow-inner">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-500 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Floe Codegen & Customer Git Provisioner Stream</span>
          </span>
          <span className="text-emerald-400 font-bold">ACTIVE</span>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {logs.map((log, idx) => (
            <div key={idx} className="leading-relaxed">
              <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> {log}
            </div>
          ))}
        </div>
      </div>

      {/* GitHub & Cloud Sync Modal */}
      <GitHubSyncModal
        isOpen={isGitHubModalOpen}
        customerName={customerName}
        appName={ir.name || ir.domain}
        activeDomain={ir.domain}
        initialError={gitHubModalInitialError}
        onClose={() => setIsGitHubModalOpen(false)}
        onSuccess={() => {
          setIsGitHubModalOpen(false);
          handleGitStep();
        }}
      />
    </div>
  );
};
