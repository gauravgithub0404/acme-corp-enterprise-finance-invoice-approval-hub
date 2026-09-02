import React, { useState } from 'react';
import { IntermediateRepresentation } from '../types/floe';
import { AuthUser, UserRole, checkPermission } from '../types/auth';
import { 
  Building2, TrendingUp, Users, DollarSign, CheckCircle2, 
  XCircle, Sparkles, Send, RefreshCw, AlertTriangle, 
  Clock, ArrowRight, ShieldCheck, Tag, Plus, Check
} from 'lucide-react';

interface CrmSandboxViewProps {
  ir: IntermediateRepresentation;
  currentUser: AuthUser;
  activeRole: UserRole;
  onSwitchRole: (role: UserRole) => void;
}

export interface OpportunityRecord {
  id: string;
  name: string;
  accountName: string;
  dealValue: number;
  currency: 'USD' | 'EUR' | 'GBP';
  stage: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  leadScore: number;
  discountPercentage: number;
  contactName: string;
  contactEmail: string;
  ownerName: string;
  aiInsights: {
    scoreNote: string;
    propensity: 'High' | 'Medium' | 'Low';
    needsApproval: boolean;
  };
  managerApprovalNote?: string;
  createdAt: string;
}

export const INITIAL_DEALS: OpportunityRecord[] = [
  {
    id: 'OPP-101',
    name: 'Enterprise Cloud Security & Zero-Trust Rollout',
    accountName: 'Acme Financial Services',
    dealValue: 125000,
    currency: 'USD',
    stage: 'negotiation',
    leadScore: 92,
    discountPercentage: 15,
    contactName: 'Daniel Hayes (CISO)',
    contactEmail: 'daniel.hayes@acmefinancial.com',
    ownerName: 'Alex Rivera',
    aiInsights: {
      scoreNote: '🤖 AI Scoring Node [s1]: Lead propensity 92/100 based on security audit urgency. Deal value ($125,000) exceeds $100k threshold → Requires Sales Manager sign-off.',
      propensity: 'High',
      needsApproval: true
    },
    createdAt: '3 days ago'
  },
  {
    id: 'OPP-102',
    name: '500-Seat Floe Studio Developer Tier Expansion',
    accountName: 'Starlight Tech Innovations',
    dealValue: 48000,
    currency: 'USD',
    stage: 'proposal',
    leadScore: 84,
    discountPercentage: 5,
    contactName: 'Priya Sharma (VP Eng)',
    contactEmail: 'priya@starlight.tech',
    ownerName: 'Alex Rivera',
    aiInsights: {
      scoreNote: '🤖 AI Scoring Node [s1]: Standard pricing tier under $100k threshold. Auto-advance eligible upon contract return.',
      propensity: 'High',
      needsApproval: false
    },
    createdAt: '1 week ago'
  },
  {
    id: 'OPP-103',
    name: 'Global Supply Chain Postgres Analytics Integration',
    accountName: 'Nexus Global Logistics',
    dealValue: 210000,
    currency: 'USD',
    stage: 'won',
    leadScore: 96,
    discountPercentage: 10,
    contactName: 'Markus Lindberg (CIO)',
    contactEmail: 'm.lindberg@nexuslogistics.com',
    ownerName: 'Alex Rivera',
    aiInsights: {
      scoreNote: '🤖 AI Scoring Node [s1]: Deal successfully authorized by Sales Manager (Marcus Vance).',
      propensity: 'High',
      needsApproval: false
    },
    managerApprovalNote: 'Approved by Marcus Vance (Sales Manager). Contract signed.',
    createdAt: '2 weeks ago'
  }
];

export const CrmSandboxView: React.FC<CrmSandboxViewProps> = ({
  ir,
  currentUser,
  activeRole,
  onSwitchRole
}) => {
  const [deals, setDeals] = useState<OpportunityRecord[]>(INITIAL_DEALS);
  const [stageFilter, setStageFilter] = useState<string>('all');
  
  // Deal Form
  const [dealName, setDealName] = useState('Enterprise Multi-Region Database Modernization');
  const [accountName, setAccountName] = useState('Hyperion Health Technologies');
  const [dealValue, setDealValue] = useState('85000');
  const [contactName, setContactName] = useState('Claire Vance (CTO)');
  const [contactEmail, setContactEmail] = useState('claire.vance@hyperionhealth.io');
  const [discountPercentage, setDiscountPercentage] = useState('8');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  const handleQuickFillCrm = () => {
    setDealName('Global SOC-2 Compliance & IAM Gateway');
    setAccountName('OmniGlobal Retail Corp');
    setDealValue('145000');
    setContactName('Gregory House (CISO)');
    setContactEmail('ghouse@omniglobal.com');
    setDiscountPercentage('12');
  };

  const handleCreateDeal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(dealValue) || 0;
    setIsSubmitting(true);
    setSubmissionFeedback(null);

    setTimeout(() => {
      const score = Math.floor(75 + Math.random() * 23);
      const needsApproval = val > 100000;
      const scoreNote = needsApproval
        ? `🤖 AI Scoring Node [s1]: Lead scored ${score}/100. Deal value ($${val.toLocaleString()}) exceeds $100k threshold → Requires Sales Manager sign-off to close-won.`
        : `🤖 AI Scoring Node [s1]: Lead scored ${score}/100. Deal value ($${val.toLocaleString()}) within standard sales rep closing authority (<$100k).`;

      const newDeal: OpportunityRecord = {
        id: `OPP-${Math.floor(100 + Math.random() * 900)}`,
        name: dealName,
        accountName,
        dealValue: val,
        currency: 'USD',
        stage: 'qualified',
        leadScore: score,
        discountPercentage: parseFloat(discountPercentage) || 0,
        contactName,
        contactEmail,
        ownerName: currentUser.name,
        aiInsights: {
          scoreNote,
          propensity: score > 85 ? 'High' : 'Medium',
          needsApproval
        },
        createdAt: 'Just now'
      };

      setDeals(prev => [newDeal, ...prev]);
      setIsSubmitting(false);
      setSubmissionFeedback(`✅ Opportunity "${dealName}" created and scored ${score}/100 by AI Lead Scorer.`);
    }, 500);
  };

  const handleAdvanceStage = (dealId: string, nextStage: OpportunityRecord['stage']) => {
    const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin' || activeRole === 'sales_manager';
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    if (nextStage === 'won' && deal.dealValue > 100000 && !isManagerOrAdmin) {
      alert(`[RBAC Policy Violation] Deals over $100,000 require Sales Manager approval to advance to 'Closed-Won'. Please switch to Sales Manager (Marcus) or Admin (Elena).`);
      return;
    }

    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        stage: nextStage,
        managerApprovalNote: nextStage === 'won' ? `Authorized by ${currentUser.name} (${currentUser.roleTitle})` : d.managerApprovalNote
      };
    }));
  };

  const filteredDeals = deals.filter(d => {
    if (stageFilter !== 'all' && d.stage !== stageFilter) return false;
    return true;
  });

  const totalPipeline = deals.reduce((acc, curr) => acc + curr.dealValue, 0);
  const wonPipeline = deals.filter(d => d.stage === 'won').reduce((acc, curr) => acc + curr.dealValue, 0);

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-slate-400 text-xs">Total Pipeline Value</span>
          <p className="mt-2 text-2xl font-bold text-white">${totalPipeline.toLocaleString()}</p>
          <span className="text-[11px] text-indigo-400 font-medium">{deals.length} Active Deals</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-slate-400 text-xs">Closed-Won Revenue</span>
          <p className="mt-2 text-2xl font-bold text-emerald-400">${wonPipeline.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Validated deals</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-slate-400 text-xs">Average AI Lead Score</span>
          <p className="mt-2 text-2xl font-bold text-sky-400">
            {Math.round(deals.reduce((acc, d) => acc + d.leadScore, 0) / deals.length)}/100
          </p>
          <span className="text-[11px] text-slate-400">Propensity engine active</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-slate-400 text-xs">Manager Gate Threshold</span>
          <p className="mt-2 text-2xl font-bold text-amber-400">$100,000</p>
          <span className="text-[11px] text-slate-400">Deterministic ceiling</span>
        </div>
      </div>

      {/* Main Grid: Add Opportunity & Pipeline Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Create Opportunity Form */}
        <div className="lg:col-span-5 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Create Sales Opportunity</h3>
            </div>
            <button
              type="button"
              onClick={handleQuickFillCrm}
              className="px-2.5 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 text-[11px] font-semibold"
            >
              Sample Fill
            </button>
          </div>

          <form onSubmit={handleCreateDeal} className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-300">Opportunity Name *</label>
              <input
                type="text"
                required
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300">Account Name *</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300">Deal Value ($) *</label>
                <input
                  type="number"
                  required
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300">Contact Person</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300">Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Submit & Run AI Lead Scoring</span>
            </button>

            {submissionFeedback && (
              <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-800 text-sky-200 text-xs">
                {submissionFeedback}
              </div>
            )}
          </form>
        </div>

        {/* Deals Pipeline Ledger */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-white">Pipeline Opportunities</span>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
              {['all', 'qualified', 'proposal', 'negotiation', 'won'].map(st => (
                <button
                  key={st}
                  onClick={() => setStageFilter(st)}
                  className={`px-2.5 py-1 rounded-lg capitalize ${stageFilter === st ? 'bg-sky-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredDeals.map(d => (
              <div key={d.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{d.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-200">
                        {d.stage}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                        AI Score: {d.leadScore}/100
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1">{d.name}</h4>
                    <p className="text-xs text-slate-400">{d.accountName} • {d.contactName} ({d.contactEmail})</p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-bold text-white font-mono">${d.dealValue.toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                  {d.aiInsights.scoreNote}
                </div>

                {d.stage !== 'won' && d.stage !== 'lost' && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <span className="text-slate-400">Advance stage:</span>
                    <div className="flex items-center gap-2">
                      {d.stage === 'qualified' && (
                        <button
                          onClick={() => handleAdvanceStage(d.id, 'proposal')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white"
                        >
                          → Proposal
                        </button>
                      )}
                      {d.stage === 'proposal' && (
                        <button
                          onClick={() => handleAdvanceStage(d.id, 'negotiation')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white"
                        >
                          → Negotiation
                        </button>
                      )}
                      {d.stage === 'negotiation' && (
                        <button
                          onClick={() => handleAdvanceStage(d.id, 'won')}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          🏆 Mark Close-Won
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {d.managerApprovalNote && (
                  <div className="text-xs text-emerald-400 font-medium">
                    ✓ {d.managerApprovalNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
