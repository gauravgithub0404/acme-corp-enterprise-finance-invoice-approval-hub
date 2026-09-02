import React, { useState } from 'react';
import { IntermediateRepresentation } from '../types/floe';
import { AuthUser, UserRole, checkPermission } from '../types/auth';
import { 
  Receipt, DollarSign, CheckCircle2, XCircle, Sparkles, 
  Send, ShieldCheck, RefreshCw, AlertTriangle, Shield, 
  FileText, ArrowRight, Building2, Check, Clock, Filter,
  ExternalLink, CreditCard, Tag, Eye, ChevronRight
} from 'lucide-react';

interface FinanceInvoiceSandboxViewProps {
  ir: IntermediateRepresentation;
  currentUser: AuthUser;
  activeRole: UserRole;
  onSwitchRole: (role: UserRole) => void;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  vendorTaxId: string;
  costCenter: string;
  amount: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'INR';
  dueDate: string;
  description: string;
  submittedBy: string;
  submitterEmail: string;
  attachmentName?: string;
  aiBudgetAudit: {
    status: 'compliant' | 'warning' | 'flagged';
    notes: string;
    confidence: number;
    duplicateRisk: 'none' | 'low' | 'high';
  };
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  submittedAt: string;
  managerNotes?: string;
  paidAt?: string;
  workflowRunId: string;
}

export const INITIAL_INVOICES: InvoiceRecord[] = [
  {
    id: 'INV-2026-0841',
    invoiceNumber: 'AWS-991204',
    vendorName: 'Amazon Web Services (AWS)',
    vendorTaxId: 'US-91-1646860',
    costCenter: 'CC-ENG-102 (Infrastructure & Cloud)',
    amount: 12450.00,
    currency: 'USD',
    dueDate: '2026-09-25',
    description: 'Q3 Enterprise Multi-AZ EKS clusters, S3 telemetry data ingress, and CloudFront CDN bandwidth.',
    submittedBy: 'Wei Zhang',
    submitterEmail: 'wei.zhang@floe.internal',
    attachmentName: 'aws_invoice_august_2026.pdf',
    aiBudgetAudit: {
      status: 'compliant',
      notes: '🤖 AI Budget Node [s1]: Verified against Q3 Infrastructure Budget allocation ($15,000 cap). Variance is -17.0% (within bounds). No duplicate tax ID or amount match detected in prior 60 days.',
      confidence: 0.98,
      duplicateRisk: 'none'
    },
    status: 'submitted',
    submittedAt: '2 hours ago',
    workflowRunId: 'wf-inv-9941'
  },
  {
    id: 'INV-2026-0839',
    invoiceNumber: 'DD-44102',
    vendorName: 'Datadog Observability Inc.',
    vendorTaxId: 'US-46-1289410',
    costCenter: 'CC-SECOPS-201 (Security Operations)',
    amount: 3200.00,
    currency: 'USD',
    dueDate: '2026-09-20',
    description: 'Monthly APM tracing, synthetic monitoring endpoints, and security posture management hosts.',
    submittedBy: 'Wei Zhang',
    submitterEmail: 'wei.zhang@floe.internal',
    attachmentName: 'datadog_inv_44102.pdf',
    aiBudgetAudit: {
      status: 'compliant',
      notes: '🤖 AI Budget Node [s1]: Under $5,000 standard auto-clear threshold. Tax ID matched verified vendor directory. Approved by Finance Operations Gate.',
      confidence: 1.0,
      duplicateRisk: 'none'
    },
    status: 'approved',
    submittedAt: 'Yesterday',
    managerNotes: 'Approved by Sophia Sterling (Finance Manager). Queued for scheduled ACH payment run.',
    workflowRunId: 'wf-inv-9938'
  },
  {
    id: 'INV-2026-0835',
    invoiceNumber: 'SNOW-8812',
    vendorName: 'Snowflake Data Cloud',
    vendorTaxId: 'US-45-5421990',
    costCenter: 'CC-DATA-304 (Data Warehouse & BI)',
    amount: 18750.00,
    currency: 'USD',
    dueDate: '2026-09-15',
    description: 'Annual enterprise data compute credits replenishment and global replica compute warehouses.',
    submittedBy: 'Wei Zhang',
    submitterEmail: 'wei.zhang@floe.internal',
    attachmentName: 'snowflake_contract_invoice.pdf',
    aiBudgetAudit: {
      status: 'compliant',
      notes: '🤖 AI Budget Node [s1]: Large invoice (>$10k) cross-referenced with executed Master Services Agreement (MSA-2026-04). Compliant with corporate procurement threshold.',
      confidence: 0.97,
      duplicateRisk: 'none'
    },
    status: 'paid',
    submittedAt: '3 days ago',
    managerNotes: 'Authorized by Sophia Sterling. Wire settlement completed on 2026-08-30.',
    paidAt: '2026-08-30 at 2:15 PM',
    workflowRunId: 'wf-inv-9920'
  },
  {
    id: 'INV-2026-0830',
    invoiceNumber: 'GITS-1029',
    vendorName: 'Global IT Solutions Ltd',
    vendorTaxId: 'GB-992-1082-44',
    costCenter: 'CC-ENG-102 (Infrastructure & Cloud)',
    amount: 8500.00,
    currency: 'USD',
    dueDate: '2026-09-10',
    description: 'External DevOps consulting hours for migration sprint.',
    submittedBy: 'Wei Zhang',
    submitterEmail: 'wei.zhang@floe.internal',
    attachmentName: 'gits_consulting_invoice.pdf',
    aiBudgetAudit: {
      status: 'flagged',
      notes: '⚠️ AI Duplicate Warning [s1]: High-probability duplicate submission detected. Identical vendor and amount ($8,500.00) matched invoice INV-2026-0792 paid 12 days ago.',
      confidence: 0.94,
      duplicateRisk: 'high'
    },
    status: 'rejected',
    submittedAt: '1 week ago',
    managerNotes: 'Rejected by Sophia Sterling: Duplicate claim for August migration hours. Re-submit with itemized timesheet.',
    workflowRunId: 'wf-inv-9915'
  }
];

export const FinanceInvoiceSandboxView: React.FC<FinanceInvoiceSandboxViewProps> = ({
  ir,
  currentUser,
  activeRole,
  onSwitchRole
}) => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Submission Form State
  const [vendorName, setVendorName] = useState('CrowdStrike Falcon Security');
  const [vendorTaxId, setVendorTaxId] = useState('US-47-2109482');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [costCenter, setCostCenter] = useState('CC-SECOPS-201 (Security Operations)');
  const [amount, setAmount] = useState('4800.00');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'INR'>('USD');
  const [dueDate, setDueDate] = useState('2026-10-15');
  const [description, setDescription] = useState('Endpoint detection & response threat hunting agent licenses for Q4 workstation fleet.');
  const [attachmentName, setAttachmentName] = useState('crowdstrike_q4_invoice.pdf');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  // Selected Invoice Detail Drawer
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  // 1-Click Sample Preset
  const handleQuickFillInvoice = () => {
    setVendorName('Figma Enterprise Design');
    setVendorTaxId('US-46-3391820');
    setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setCostCenter('CC-DESIGN-202 (Product UX & Design)');
    setAmount('5400.00');
    setCurrency('USD');
    const future = new Date();
    future.setDate(future.getDate() + 30);
    setDueDate(future.toISOString().split('T')[0]);
    setDescription('Annual renewal for 45 Organization Figma Design seats and FigJam collaboration licenses.');
    setAttachmentName('figma_org_renewal_2026.pdf');
  };

  // Submit Invoice
  const handleSubmitInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setSubmissionFeedback('❌ Please enter a valid invoice amount greater than $0.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionFeedback(null);

    setTimeout(() => {
      // Deterministic & AI Budget Logic
      let auditStatus: 'compliant' | 'warning' | 'flagged' = 'compliant';
      let duplicateRisk: 'none' | 'low' | 'high' = 'none';
      let confidence = 0.97;
      let notes = '';

      // Check for duplicates
      const isDuplicate = invoices.some(inv => 
        inv.vendorName.toLowerCase() === vendorName.toLowerCase() && 
        Math.abs(inv.amount - numAmount) < 0.01 &&
        inv.status !== 'rejected'
      );

      if (isDuplicate) {
        auditStatus = 'flagged';
        duplicateRisk = 'high';
        confidence = 0.95;
        notes = `⚠️ AI Policy Node [s1]: Duplicate vendor and amount alert. A prior submission for "${vendorName}" ($${numAmount.toFixed(2)}) exists in active records.`;
      } else if (numAmount > 15000) {
        auditStatus = 'warning';
        confidence = 0.92;
        notes = `🤖 AI Policy Node [s1]: Amount ($${numAmount.toFixed(2)}) exceeds standard departmental $15k limit. Requires secondary CFO sign-off.`;
      } else if (numAmount <= 5000) {
        notes = `🤖 AI Policy Node [s1]: Within cost-center budget threshold ($5k limit). Vendor tax ID ${vendorTaxId} verified against registry.`;
      } else {
        notes = `🤖 AI Policy Node [s1]: Standard vendor invoice submission. Verified against cost-center ${costCenter}. Escalated to Finance Manager approval gate.`;
      }

      const newInv: InvoiceRecord = {
        id: `INV-${Date.now().toString().slice(-4)}`,
        invoiceNumber,
        vendorName,
        vendorTaxId,
        costCenter,
        amount: numAmount,
        currency,
        dueDate,
        description,
        submittedBy: currentUser.name,
        submitterEmail: currentUser.email,
        attachmentName,
        aiBudgetAudit: {
          status: auditStatus,
          notes,
          confidence,
          duplicateRisk
        },
        status: 'submitted',
        submittedAt: 'Just now',
        workflowRunId: `wf-inv-${Date.now().toString().slice(-4)}`
      };

      setInvoices(prev => [newInv, ...prev]);
      setIsSubmitting(false);
      setSubmissionFeedback(`✅ Invoice ${invoiceNumber} recorded! Step 1 (AI Budget & Duplicate Audit) completed.`);
      setSelectedInvoice(newInv);
    }, 600);
  };

  // Manager Decision
  const handleManagerDecision = (invId: string, decision: 'approve' | 'reject') => {
    const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin' || activeRole === 'finance' || activeRole === 'finance_manager';
    if (!isManagerOrAdmin) {
      alert(`[RBAC Policy Violation] Persona ${currentUser.name} (${activeRole}) does not possess financial approval authority ('update:Invoice.status'). Please switch to Finance Manager (Sophia) or Admin (Elena).`);
      return;
    }

    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invId) return inv;
      const isApprove = decision === 'approve';
      return {
        ...inv,
        status: isApprove ? 'approved' : 'rejected',
        managerNotes: isApprove 
          ? `Approved by ${currentUser.name} (${currentUser.roleTitle}). Authorized for payment run.`
          : `Rejected by ${currentUser.name} (${currentUser.roleTitle}). Reason: Budget ceiling or policy non-compliance.`
      };
    }));

    if (selectedInvoice && selectedInvoice.id === invId) {
      setSelectedInvoice(prev => prev ? {
        ...prev,
        status: decision === 'approve' ? 'approved' : 'rejected',
        managerNotes: decision === 'approve'
          ? `Approved by ${currentUser.name} (${currentUser.roleTitle}). Authorized for payment run.`
          : `Rejected by ${currentUser.name} (${currentUser.roleTitle}).`
      } : null);
    }
  };

  // Mark as Paid / Wire Disbursed
  const handleSettlePayment = (invId: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invId) return inv;
      return {
        ...inv,
        status: 'paid',
        paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' today'
      };
    }));

    if (selectedInvoice && selectedInvoice.id === invId) {
      setSelectedInvoice(prev => prev ? {
        ...prev,
        status: 'paid',
        paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' today'
      } : null);
    }
  };

  // Filtered List
  const filteredInvoices = invoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        inv.vendorName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.costCenter.toLowerCase().includes(q) ||
        inv.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Analytics Metrics
  const totalSubmitted = invoices.reduce((acc, curr) => acc + curr.amount, 0);
  const totalApproved = invoices.filter(i => i.status === 'approved' || i.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingCount = invoices.filter(i => i.status === 'submitted' || i.status === 'under_review').length;
  const flaggedCount = invoices.filter(i => i.aiBudgetAudit.status === 'flagged' || i.aiBudgetAudit.duplicateRisk === 'high').length;

  return (
    <div className="space-y-6">
      
      {/* Top Value Statement & Domain Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Invoices</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{pendingCount}</p>
          <span className="text-[11px] text-amber-400 font-medium">
            {pendingCount === 0 ? 'All caught up' : `${pendingCount} awaiting approval`}
          </span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Approved & Paid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            ${totalApproved.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400">
            {invoices.filter(i => i.status === 'paid').length} payments disbursed
          </span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>AI Duplicate & Budget Flags</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-400">{flaggedCount}</p>
          <span className="text-[11px] text-slate-400">
            100% automated OCR audit
          </span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>PostgreSQL Relational Storage</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{invoices.length} Invoices</p>
          <span className="text-[11px] text-indigo-300 font-mono">
            {ir.entities?.length || 2} Tables (Vendor, Invoice)
          </span>
        </div>

      </div>

      {/* Main 2-Column Layout: Submit Form & Invoices Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Vendor Invoice Intake Form (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Submit Vendor Invoice</h3>
                <p className="text-[11px] text-slate-400">AP Clerk Intake & AI Budget Validation</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleQuickFillInvoice}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-[11px] font-semibold transition-colors"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Sample Fill</span>
            </button>
          </div>

          <form onSubmit={handleSubmitInvoice} className="space-y-3.5 text-xs">
            
            {/* Vendor Name & Tax ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-300">
                  Vendor Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. AWS Cloud Services"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-300">
                  Vendor Tax ID / EIN
                </label>
                <input
                  type="text"
                  value={vendorTaxId}
                  onChange={(e) => setVendorTaxId(e.target.value)}
                  placeholder="e.g. US-91-1646860"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Invoice Number & Cost Center */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-300">
                  Invoice Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-0841"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-300">
                  Cost Center <span className="text-rose-400">*</span>
                </label>
                <select
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="CC-ENG-102 (Infrastructure & Cloud)">CC-ENG-102 (Infrastructure & Cloud)</option>
                  <option value="CC-SECOPS-201 (Security Operations)">CC-SECOPS-201 (Security Operations)</option>
                  <option value="CC-DATA-304 (Data Warehouse & BI)">CC-DATA-304 (Data Warehouse & BI)</option>
                  <option value="CC-DESIGN-202 (Product UX & Design)">CC-DESIGN-202 (Product UX & Design)</option>
                  <option value="CC-OPS-101 (General Operations)">CC-OPS-101 (General Operations)</option>
                </select>
              </div>
            </div>

            {/* Amount, Currency & Due Date */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2 space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-300">
                  Amount <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-300">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Description & Line Items */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-300">
                Line Items / Description <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Itemized deliverables, cloud usage period, or purchase order reference..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Simulated PDF Attachment */}
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 text-xs truncate">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-mono text-[11px] truncate">{attachmentName}</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                PDF Attached
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating AI Budget Node...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Invoice for Approval</span>
                </>
              )}
            </button>

            {submissionFeedback && (
              <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800 text-indigo-200 text-xs animate-in fade-in">
                {submissionFeedback}
              </div>
            )}

          </form>
        </div>

        {/* Right Column: Invoices Ledger & Details (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Header Controls & Filters */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Invoices Ledger</span>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                {filteredInvoices.length} of {invoices.length}
              </span>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
              {['all', 'submitted', 'approved', 'paid', 'rejected'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-colors ${
                    statusFilter === st ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices List */}
          <div className="space-y-3">
            {filteredInvoices.map((inv) => {
              const isSelected = selectedInvoice?.id === inv.id;
              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-950 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{inv.invoiceNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inv.status === 'paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          inv.status === 'approved' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                          inv.status === 'rejected' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                          'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {inv.status.replace('_', ' ')}
                        </span>

                        {inv.aiBudgetAudit.duplicateRisk === 'high' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Duplicate Risk</span>
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-100 mt-1">{inv.vendorName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{inv.description}</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-base font-extrabold text-white font-mono">
                        ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        Due {inv.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* AI Audit Telemetry Banner on the Card */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="truncate max-w-md">{inv.aiBudgetAudit.notes}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[10px]">{inv.submittedAt}</span>
                  </div>

                  {/* Decision Actions Bar for Managers & Admins */}
                  {isSelected && (
                    <div className="mt-4 pt-3 border-t border-indigo-900/60 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                      <div className="text-[11px] text-slate-400">
                        <span>Submitted by: <b>{inv.submittedBy}</b> ({inv.costCenter})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {inv.status === 'submitted' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleManagerDecision(inv.id, 'approve'); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve Invoice</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleManagerDecision(inv.id, 'reject'); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {inv.status === 'approved' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSettlePayment(inv.id); }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Schedule & Disburse Wire</span>
                          </button>
                        )}

                        {inv.status === 'paid' && (
                          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Settled: {inv.paidAt || 'Disbursed'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}

            {filteredInvoices.length === 0 && (
              <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400">
                <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">No invoices found</p>
                <p className="text-xs text-slate-500 mt-1">Try selecting a different status filter or submit a new invoice on the left.</p>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
