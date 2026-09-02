import React, { useEffect, useState, useCallback } from 'react';
import { X, Shield, ShieldAlert, ListChecks, GitBranch, Zap, RefreshCw, Cpu, Key, PlayCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  GovernanceAuditEntry,
  PendingApproval,
  LadderEntry,
  CircuitBreakerState
} from '../types/governance';
import { FloeStudioUser } from '../types/auth';
import { studioAuthHeaders } from '../utils/studioSession';
import { AiSystemConfig, AI_MODELS_CATALOG, AI_PROVIDERS_METADATA } from '../types/aiProvider';

interface GovernanceCenterProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: FloeStudioUser | null;
  onOpenAiSettings?: () => void;
}

type TabId = 'pending' | 'audit' | 'ladder' | 'circuit_breaker' | 'floors' | 'ai_providers';

/**
 * Governance Center — the visible, queryable surface of the agent-governance
 * module (src/engine/governance/*). This is a viewer + human-decision UI on
 * top of the same REST API the rest of the platform uses to enforce hard
 * floors, the earned-autonomy ladder, the circuit breaker, and the audit
 * trail. Nothing here bypasses those checks; it only renders their state and
 * lets an authorized human record decisions.
 */
export const GovernanceCenter: React.FC<GovernanceCenterProps> = ({ isOpen, onClose, currentUser, onOpenAiSettings }) => {
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [audit, setAudit] = useState<GovernanceAuditEntry[]>([]);
  const [ladder, setLadder] = useState<LadderEntry[]>([]);
  const [breakers, setBreakers] = useState<CircuitBreakerState[]>([]);
  const [hardFloors, setHardFloors] = useState<Array<{ pattern: string; description: string }>>([]);
  const [aiConfig, setAiConfig] = useState<AiSystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const [pendingRes, auditRes, ladderRes, floorsRes, breakerRes, aiRes] = await Promise.all([
        fetch('/api/governance/pending').then(r => r.json()),
        fetch('/api/governance/audit?limit=100').then(r => r.json()),
        fetch('/api/governance/ladder').then(r => r.json()),
        fetch('/api/governance/hard-floors').then(r => r.json()),
        fetch('/api/governance/circuit-breaker').then(r => r.json()),
        fetch('/api/admin/ai-config').then(r => r.ok ? r.json() : null).catch(() => null)
      ]);
      setPending(pendingRes.pending || []);
      setAudit(auditRes.entries || []);
      setLadder(ladderRes.entries || []);
      setHardFloors(floorsRes.floors || []);
      setBreakers(breakerRes.states || []);
      if (aiRes) setAiConfig(aiRes);
    } catch (err: any) {
      setActionError(`Failed to load governance state: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const decide = async (toolCallId: string, decision: 'approve' | 'deny') => {
    setActionError(null);
    try {
      const res = await fetch(`/api/governance/decisions/${toolCallId}`, {
        method: 'POST',
        headers: studioAuthHeaders(),
        body: JSON.stringify({
          decision,
          decidedBy: currentUser?.id || 'unknown-approver',
          reasoning: `${decision === 'approve' ? 'Approved' : 'Denied'} via Governance Center by ${currentUser?.name || 'unknown'}.`
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || `Failed to ${decision} tool call.`);
        return;
      }
      await refresh();
    } catch (err: any) {
      setActionError(`Failed to ${decision} tool call: ${err.message}`);
    }
  };

  const resetBreaker = async (actorId: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/governance/circuit-breaker/${encodeURIComponent(actorId)}/reset`, {
        method: 'POST',
        headers: studioAuthHeaders(),
        body: JSON.stringify({ resetBy: currentUser?.id || 'unknown-approver' })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || 'Failed to reset circuit breaker.');
        return;
      }
      await refresh();
    } catch (err: any) {
      setActionError(`Failed to reset circuit breaker: ${err.message}`);
    }
  };

  const revokeLadderEntry = async (actorId: string, actionType: string) => {
    setActionError(null);
    try {
      const res = await fetch('/api/governance/ladder/revoke', {
        method: 'POST',
        headers: studioAuthHeaders(),
        body: JSON.stringify({
          actorId,
          actionType,
          revokedBy: currentUser?.id || 'unknown-approver',
          reason: 'Revoked via Governance Center.'
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || 'Failed to revoke ladder entry.');
        return;
      }
      await refresh();
    } catch (err: any) {
      setActionError(`Failed to revoke ladder entry: ${err.message}`);
    }
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'pending', label: 'Pending Approvals', icon: <ShieldAlert className="w-3.5 h-3.5" />, count: pending.length },
    { id: 'audit', label: 'Audit Trail', icon: <ListChecks className="w-3.5 h-3.5" />, count: audit.length },
    { id: 'ladder', label: 'Approval Ladder', icon: <GitBranch className="w-3.5 h-3.5" />, count: ladder.length },
    { id: 'circuit_breaker', label: 'Circuit Breaker', icon: <Zap className="w-3.5 h-3.5" />, count: breakers.filter(b => b.tripped).length || undefined },
    { id: 'floors', label: 'Hard Floors', icon: <Shield className="w-3.5 h-3.5" />, count: hardFloors.length },
    { id: 'ai_providers', label: 'AI Models & Providers', icon: <Cpu className="w-3.5 h-3.5 text-indigo-500" /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Governance Center</h2>
              <p className="text-xs text-slate-500">
                Hard floors, earned-autonomy ladder, circuit breaker, and the full agent audit trail.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 border-b border-slate-200 flex gap-4 text-xs font-semibold overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 py-3 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}</span>
            </button>
          ))}
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {actionError}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'pending' && (
            pending.length === 0 ? (
              <EmptyState text="No tool calls are currently awaiting a human decision." />
            ) : (
              <div className="space-y-3">
                {pending.map(p => (
                  <div key={p.toolCall.id} className="p-3.5 border border-amber-200 bg-amber-50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900">{p.toolCall.actionType}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{p.approvalSource}</span>
                    </div>
                    <p className="text-xs text-slate-700">{p.toolCall.summary}</p>
                    <p className="text-[11px] text-slate-500">{p.reason}</p>
                    <div className="text-[10px] text-slate-400">
                      Requested by {p.toolCall.actor.name} ({p.toolCall.actor.id}) · {new Date(p.createdAt).toLocaleString()}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => decide(p.toolCall.id, 'approve')}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decide(p.toolCall.id, 'deny')}
                        className="px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'audit' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 font-sans">
                    <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                    <th className="py-2.5 px-3 font-semibold">Actor</th>
                    <th className="py-2.5 px-3 font-semibold">Action Type</th>
                    <th className="py-2.5 px-3 font-semibold">Decision</th>
                    <th className="py-2.5 px-3 font-semibold">Source</th>
                    <th className="py-2.5 px-3 font-semibold">Decided By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {audit.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        No governance decisions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    audit.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                        <td className="py-2.5 px-3">{entry.toolCall.actor.name} ({entry.toolCall.actor.id})</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{entry.toolCall.actionType}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            entry.decision === 'DENIED' ? 'bg-red-50 text-red-700' :
                            entry.decision === 'ESCALATED' ? 'bg-amber-50 text-amber-700' :
                            'bg-emerald-50 text-emerald-700'
                          }`}>
                            {entry.decision}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{entry.approvalSource}</td>
                        <td className="py-2.5 px-3 text-slate-400">{entry.decidedBy || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'ladder' && (
            ladder.length === 0 ? (
              <EmptyState text="No actor/action pairs have graduated the approval ladder yet. Everything is still one-off approval by default." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 font-sans">
                      <th className="py-2.5 px-3 font-semibold">Actor</th>
                      <th className="py-2.5 px-3 font-semibold">Action Type</th>
                      <th className="py-2.5 px-3 font-semibold">Rung</th>
                      <th className="py-2.5 px-3 font-semibold">Granted By</th>
                      <th className="py-2.5 px-3 font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {ladder.map(entry => (
                      <tr key={`${entry.actorId}:${entry.actionType}`} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">{entry.actorId}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{entry.actionType}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            entry.rung === 'allowlisted' ? 'bg-indigo-50 text-indigo-700' :
                            entry.rung === 'standing_rule' ? 'bg-sky-50 text-sky-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {entry.rung}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{entry.grantedBy || '—'}</td>
                        <td className="py-2.5 px-3">
                          {entry.rung !== 'none' && (
                            <button
                              onClick={() => revokeLadderEntry(entry.actorId, entry.actionType)}
                              className="text-[10px] font-bold text-red-600 hover:text-red-800"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'circuit_breaker' && (
            breakers.length === 0 ? (
              <EmptyState text="No circuit breaker state recorded for any actor yet." />
            ) : (
              <div className="space-y-2">
                {breakers.map(b => (
                  <div key={b.actorId} className={`p-3 rounded-xl border flex items-center justify-between ${
                    b.tripped ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <span className="text-xs font-bold text-slate-900">{b.actorId}</span>
                      <p className="text-[11px] text-slate-500">
                        {b.consecutiveDenials} consecutive denial{b.consecutiveDenials === 1 ? '' : 's'}
                        {b.tripped && b.trippedAt ? ` · tripped ${new Date(b.trippedAt).toLocaleString()}` : ''}
                      </p>
                    </div>
                    {b.tripped ? (
                      <button
                        onClick={() => resetBreaker(b.actorId)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold"
                      >
                        Reset (human-only)
                      </button>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">OK</span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'floors' && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 mb-2">
                These actions are human-only, always. No mode — including auto-approve — can lower this list; it is
                not configurable at runtime and has no admin UI to change it.
              </p>
              {hardFloors.map(floor => (
                <div key={floor.pattern} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs font-bold font-mono text-slate-900">{floor.pattern}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">{floor.description}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'ai_providers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 text-white">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-indigo-300">Active Intelligence Engine</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE
                    </span>
                  </div>
                  <h3 className="text-base font-bold mt-1 text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span>{aiConfig?.activeModel || 'gpt-oss:120b-cloud'}</span>
                    <span className="text-xs font-normal text-slate-300">
                      ({aiConfig?.activeProvider ? AI_PROVIDERS_METADATA[aiConfig.activeProvider]?.displayName : 'Ollama Cloud'})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Temperature: {aiConfig?.temperature ?? 0.2} · Max Tokens: {aiConfig?.maxTokens ?? 8192} · Streaming: {aiConfig?.stream ? 'Enabled' : 'Disabled'}
                  </p>
                </div>

                {onOpenAiSettings && (
                  <button
                    type="button"
                    onClick={onOpenAiSettings}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Manage Keys & Models</span>
                  </button>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wider">
                  Supported AI Models in Floe Studio
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AI_MODELS_CATALOG.map((m) => {
                    const isCurrent = aiConfig?.activeModel === m.id;
                    const isOllama120B = m.id === 'gpt-oss:120b-cloud';

                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isCurrent
                            ? isOllama120B
                              ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500/30'
                              : 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500/30'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900">{m.name}</span>
                            {m.badge && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                isOllama120B
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}>
                                {m.badge}
                              </span>
                            )}
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mb-2">
                          {m.description}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
                          <span>Context: <b className="font-mono text-slate-700">{Math.round(m.contextWindow / 1024)}k tokens</b></span>
                          <span>Inference: <b className="text-slate-700">{m.speedRating}</b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-10 text-center text-slate-500 text-xs">{text}</div>
);
