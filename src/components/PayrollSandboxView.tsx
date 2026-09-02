import React, { useState } from 'react';
import { IntermediateRepresentation } from '../types/floe';
import { AuthUser, UserRole, checkPermission } from '../types/auth';
import { 
  Building2, DollarSign, CheckCircle2, XCircle, Sparkles, 
  Send, RefreshCw, AlertTriangle, Clock, ArrowRight, 
  ShieldCheck, Tag, Plus, Check, Users, FileSpreadsheet
} from 'lucide-react';

interface PayrollSandboxViewProps {
  ir: IntermediateRepresentation;
  currentUser: AuthUser;
  activeRole: UserRole;
  onSwitchRole: (role: UserRole) => void;
}

export interface PayrollRunRecord {
  id: string;
  employeeName: string;
  employeeCode: string;
  payPeriod: string;
  grossPay: number;
  taxDeductions: number;
  benefitsDeductions: number;
  netPay: number;
  bankAccountRef: string;
  taxRegion: string;
  status: 'draft' | 'under_review' | 'approved' | 'disbursed' | 'rejected';
  aiCompliance: {
    status: 'compliant' | 'warning';
    notes: string;
    anomalyScore: number;
  };
  controllerNotes?: string;
  disbursedAt?: string;
  createdAt: string;
}

export const INITIAL_PAYROLL_RUNS: PayrollRunRecord[] = [
  {
    id: 'PAY-2026-08A',
    employeeName: 'Alex Rivera',
    employeeCode: 'EMP-ENG-082',
    payPeriod: 'August 2026 (Monthly)',
    grossPay: 12500.00,
    taxDeductions: 3125.00,
    benefitsDeductions: 650.00,
    netPay: 8725.00,
    bankAccountRef: 'tok_bank_us_8819a',
    taxRegion: 'US-California',
    status: 'under_review',
    aiCompliance: {
      status: 'compliant',
      notes: '🤖 AI Compliance Node [s1]: Verified statutory tax rate (25.0%) and 401(k) deduction matching. No payroll run anomalies vs. prior 6 cycles.',
      anomalyScore: 0.02
    },
    createdAt: '2 days ago'
  },
  {
    id: 'PAY-2026-08B',
    employeeName: 'Sarah Chen',
    employeeCode: 'EMP-IT-044',
    payPeriod: 'August 2026 (Monthly)',
    grossPay: 10800.00,
    taxDeductions: 2700.00,
    benefitsDeductions: 580.00,
    netPay: 7520.00,
    bankAccountRef: 'tok_bank_us_9921b',
    taxRegion: 'US-New York',
    status: 'approved',
    aiCompliance: {
      status: 'compliant',
      notes: '🤖 AI Compliance Node [s1]: Compliance cross-check validated with New York state income tax table.',
      anomalyScore: 0.01
    },
    controllerNotes: 'Signed off by Sophia Sterling (Finance Controller). Queued for NACHA batch disburse.',
    createdAt: '3 days ago'
  },
  {
    id: 'PAY-2026-08C',
    employeeName: 'Marcus Vance',
    employeeCode: 'EMP-EXEC-012',
    payPeriod: 'August 2026 (Monthly)',
    grossPay: 18500.00,
    taxDeductions: 5550.00,
    benefitsDeductions: 950.00,
    netPay: 12000.00,
    bankAccountRef: 'tok_bank_us_1104e',
    taxRegion: 'US-California',
    status: 'disbursed',
    aiCompliance: {
      status: 'compliant',
      notes: '🤖 AI Compliance Node [s1]: Executive tier run authorized and verified against compensation committee baseline.',
      anomalyScore: 0.03
    },
    controllerNotes: 'Signed off by Sophia Sterling. Direct deposit completed.',
    disbursedAt: '2026-08-30 at 9:00 AM',
    createdAt: '1 week ago'
  }
];

export const PayrollSandboxView: React.FC<PayrollSandboxViewProps> = ({
  ir,
  currentUser,
  activeRole,
  onSwitchRole
}) => {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunRecord[]>(INITIAL_PAYROLL_RUNS);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form State
  const [employeeName, setEmployeeName] = useState('Elena Rostova');
  const [employeeCode, setEmployeeCode] = useState('EMP-SEC-009');
  const [payPeriod, setPayPeriod] = useState('August 2026 (Monthly)');
  const [grossPay, setGrossPay] = useState('16500.00');
  const [taxRegion, setTaxRegion] = useState('US-California');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleQuickFill = () => {
    setEmployeeName('Liam Scott');
    setEmployeeCode('EMP-OPS-051');
    setPayPeriod('August 2026 (Monthly)');
    setGrossPay('9500.00');
    setTaxRegion('US-Texas');
  };

  const handleCreatePayrollRun = (e: React.FormEvent) => {
    e.preventDefault();
    const gross = parseFloat(grossPay) || 0;
    const taxRate = taxRegion === 'US-Texas' ? 0.20 : 0.26;
    const tax = Math.round(gross * taxRate * 100) / 100;
    const benefits = 550.00;
    const net = gross - tax - benefits;

    setIsSubmitting(true);
    setFeedback(null);

    setTimeout(() => {
      const newRun: PayrollRunRecord = {
        id: `PAY-${Date.now().toString().slice(-4)}`,
        employeeName,
        employeeCode,
        payPeriod,
        grossPay: gross,
        taxDeductions: tax,
        benefitsDeductions: benefits,
        netPay: net,
        bankAccountRef: `tok_bank_us_${Math.random().toString(36).substring(2, 7)}`,
        taxRegion,
        status: 'under_review',
        aiCompliance: {
          status: 'compliant',
          notes: `🤖 AI Compliance Node [s1]: Verified ${taxRegion} rates ($${tax.toFixed(2)} tax / $${benefits.toFixed(2)} benefits). Tokenized bank account reference secured.`,
          anomalyScore: 0.01
        },
        createdAt: 'Just now'
      };

      setPayrollRuns(prev => [newRun, ...prev]);
      setIsSubmitting(false);
      setFeedback(`✅ Payroll run generated for ${employeeName} ($${net.toFixed(2)} Net). Awaiting Controller Sign-off.`);
    }, 500);
  };

  const handleSignOff = (runId: string, decision: 'approve' | 'reject') => {
    const isControllerOrAdmin = activeRole === 'admin' || activeRole === 'manager' || activeRole === 'finance_controller';
    if (!isControllerOrAdmin) {
      alert(`[RBAC Policy Violation] Payroll sign-off requires Finance Controller (Sophia) or Admin (Elena) authority ('update:PayrollRun.status').`);
      return;
    }

    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId) return r;
      return {
        ...r,
        status: decision === 'approve' ? 'approved' : 'rejected',
        controllerNotes: decision === 'approve'
          ? `Signed off by ${currentUser.name} (${currentUser.roleTitle}). Authorized for NACHA batch disburse.`
          : `Rejected by ${currentUser.name} (${currentUser.roleTitle}). Anomaly correction required.`
      };
    }));
  };

  const handleDisburse = (runId: string) => {
    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId) return r;
      return {
        ...r,
        status: 'disbursed',
        disbursedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' today'
      };
    }));
  };

  const totalGross = payrollRuns.reduce((acc, r) => acc + r.grossPay, 0);
  const totalNet = payrollRuns.reduce((acc, r) => acc + r.netPay, 0);
  const pendingSignOff = payrollRuns.filter(r => r.status === 'under_review').length;

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-slate-400 text-xs">Total Gross Payroll</span>
          <p className="mt-2 text-2xl font-bold text-white">${totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <span className="text-[11px] text-indigo-400 font-medium">{payrollRuns.length} Employee Runs</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-slate-400 text-xs">Net Disbursement Pool</span>
          <p className="mt-2 text-2xl font-bold text-emerald-400">${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <span className="text-[11px] text-slate-400">Post-tax & benefits</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-slate-400 text-xs">Awaiting Controller Sign-Off</span>
          <p className="mt-2 text-2xl font-bold text-amber-400">{pendingSignOff}</p>
          <span className="text-[11px] text-slate-400">48h timeout escalation</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-slate-400 text-xs">Security & Tokenization</span>
          <p className="mt-2 text-2xl font-bold text-sky-400">100%</p>
          <span className="text-[11px] text-slate-400">Zero raw bank details</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Run Generation Form */}
        <div className="lg:col-span-5 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Generate Payroll Run</h3>
            </div>
            <button
              type="button"
              onClick={handleQuickFill}
              className="px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-[11px] font-semibold"
            >
              Sample Fill
            </button>
          </div>

          <form onSubmit={handleCreatePayrollRun} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300">Employee Name *</label>
                <input
                  type="text"
                  required
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300">Employee Code *</label>
                <input
                  type="text"
                  required
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300">Gross Salary ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={grossPay}
                  onChange={(e) => setGrossPay(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300">Tax Jurisdiction</label>
                <select
                  value={taxRegion}
                  onChange={(e) => setTaxRegion(e.target.value)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="US-California">US - California</option>
                  <option value="US-New York">US - New York</option>
                  <option value="US-Texas">US - Texas (0% State)</option>
                  <option value="US-Washington">US - Washington</option>
                </select>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              🔒 Bank account reference will be automatically tokenized via vault integration.
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Generate Payroll Run & Verify Compliance</span>
            </button>

            {feedback && (
              <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800 text-indigo-200 text-xs">
                {feedback}
              </div>
            )}
          </form>
        </div>

        {/* Runs Ledger */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-white">Payroll Runs</span>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
              {['all', 'under_review', 'approved', 'disbursed'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg capitalize ${statusFilter === st ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400'}`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {payrollRuns.filter(r => statusFilter === 'all' || r.status === statusFilter).map(r => (
              <div key={r.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{r.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-200">
                        {r.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{r.taxRegion}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1">{r.employeeName} ({r.employeeCode})</h4>
                    <p className="text-xs text-slate-400">{r.payPeriod}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      ${r.netPay.toLocaleString('en-US', { minimumFractionDigits: 2 })} Net
                    </span>
                    <span className="block text-[10px] text-slate-400 font-mono">
                      Gross: ${r.grossPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                  {r.aiCompliance.notes}
                </div>

                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-500 font-mono text-[10px]">Bank Ref: {r.bankAccountRef}</span>

                  <div className="flex items-center gap-2">
                    {r.status === 'under_review' && (
                      <>
                        <button
                          onClick={() => handleSignOff(r.id, 'approve')}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          Sign Off & Authorize
                        </button>
                        <button
                          onClick={() => handleSignOff(r.id, 'reject')}
                          className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {r.status === 'approved' && (
                      <button
                        onClick={() => handleDisburse(r.id)}
                        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                      >
                        Disburse Funds (NACHA)
                      </button>
                    )}

                    {r.status === 'disbursed' && (
                      <span className="text-xs text-emerald-400 font-medium">
                        ✓ Disbursed on {r.disbursedAt}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
