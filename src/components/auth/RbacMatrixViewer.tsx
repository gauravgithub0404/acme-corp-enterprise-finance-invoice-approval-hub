import React, { useState } from 'react';
import { 
  FloePlatformRole, 
  FloeCustomerRole, 
  FLOE_PLATFORM_ROLES, 
  FLOE_CUSTOMER_ROLES, 
  FloeStudioUser,
  FLOE_STUDIO_PERSONAS,
  AuthUser,
  UserRole,
  RBAC_PERMISSIONS_REGISTRY,
  checkPermission,
  PRESET_USERS
} from '../../types/auth';
import { 
  Shield, Check, X, Users, Lock, Key, Sparkles, CheckCircle2, 
  AlertTriangle, ArrowRight, ShieldCheck, Terminal, Layers, Building2,
  Cpu, GitBranch, Flame, ArrowUpRight, HelpCircle, CheckCircle
} from 'lucide-react';

interface RbacMatrixViewerProps {
  currentUser: AuthUser;
  onSwitchRole?: (role: UserRole) => void;
}

export const RbacMatrixViewer: React.FC<RbacMatrixViewerProps> = ({
  currentUser,
  onSwitchRole
}) => {
  // Navigation tab for 3-tier RBAC architecture
  const [activeTab, setActiveTab] = useState<'architecture' | 'app_rbac' | 'customer_rbac' | 'platform_rbac' | 'simulator'>('architecture');
  
  // Policy Simulator states
  const [testScope, setTestScope] = useState<'application' | 'customer' | 'platform'>('customer');
  const [testCustomerRole, setTestCustomerRole] = useState<FloeCustomerRole>('application_builder');
  const [testAction, setTestAction] = useState<string>('release.promote');
  
  const [appTestRole, setAppTestRole] = useState<UserRole>(currentUser.role);
  const [appTestPermId, setAppTestPermId] = useState<string>('wf:approve_reject');

  // Evaluate action-based permission for Customer/Platform tiers
  const evaluateCustomerAction = (role: FloeCustomerRole, action: string) => {
    const roleDef = FLOE_CUSTOMER_ROLES[role];
    if (!roleDef) return { allowed: false, reason: 'Role definition not found' };

    if (action === 'release.promote') {
      if (roleDef.canApproveProduction) {
        return {
          allowed: true,
          reason: `AUTHORIZED (200 OK): '${roleDef.title}' is a designated Production Approver/Owner. Authorized to promote releases past governance gate.`
        };
      } else {
        return {
          allowed: false,
          reason: `FORBIDDEN (403): '${roleDef.title}' cannot approve production deployments. Requires 'Production Approver' or 'Account Owner' sign-off.`
        };
      }
    }

    if (action === 'application.generate' || action === 'requirements.create') {
      if (role === 'application_builder' || role === 'account_owner' || role === 'account_admin') {
        return {
          allowed: true,
          reason: `AUTHORIZED (200 OK): Role '${roleDef.title}' has permission '${action}' to author and generate application AST models.`
        };
      }
      return {
        allowed: false,
        reason: `FORBIDDEN (403): '${roleDef.title}' lacks permission '${action}'.`
      };
    }

    if (action === 'deployment.create' || action === 'deployment.rollback') {
      if (role === 'deployment_manager' || role === 'account_owner') {
        return {
          allowed: true,
          reason: `AUTHORIZED (200 OK): '${roleDef.title}' is authorized to execute cloud infrastructure deployments and rollbacks.`
        };
      }
      return {
        allowed: false,
        reason: `FORBIDDEN (403): '${roleDef.title}' cannot execute cloud deployments. Minimum role: 'Deployment Manager'.`
      };
    }

    if (action === 'billing.manage' || action === 'ownership.transfer') {
      if (role === 'account_owner') {
        return {
          allowed: true,
          reason: `AUTHORIZED (200 OK): '${roleDef.title}' holds supreme commercial and ownership authority.`
        };
      }
      return {
        allowed: false,
        reason: `FORBIDDEN (403): Only the designated 'Account Owner' can modify billing plans and transfer subscription ownership.`
      };
    }

    return {
      allowed: roleDef.keyPermissions.some(p => p.includes(action.split('.')[0])),
      reason: `Evaluated against action-based authorization matrix for '${action}'.`
    };
  };

  const currentEval = evaluateCustomerAction(testCustomerRole, testAction);

  return (
    <div className="space-y-6 text-slate-100 text-xs">
      
      {/* Architectural Philosophy Banner */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">Floe Clean 3-Tier RBAC Architecture</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Separation of Platform vs Customer vs Domain Roles
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Prevents architectural bleeding by decoupling <b>Floe Platform SaaS Roles</b>, <b>Customer Workspace Roles</b>, and <b>Application-Generated Domain Roles</b>.
              </p>
            </div>
          </div>

          {/* Quick Impersonate (App Level) */}
          {onSwitchRole && (
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
              <span className="text-slate-400 font-medium">App User:</span>
              <select
                value={currentUser.role}
                onChange={(e) => onSwitchRole(e.target.value as UserRole)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="employee">👨‍💻 Alex (Employee)</option>
                <option value="agent">🎧 Sarah (Agent)</option>
                <option value="manager">👔 Marcus (Manager)</option>
                <option value="admin">🛡️ Elena (Admin)</option>
              </select>
            </div>
          )}
        </div>

        {/* Tier Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-800/80 pt-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              activeTab === 'architecture'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Hierarchy & Production Gate</span>
          </button>

          <button
            onClick={() => setActiveTab('customer_rbac')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              activeTab === 'customer_rbac'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>2. Customer Account Roles (8 Core)</span>
          </button>

          <button
            onClick={() => setActiveTab('app_rbac')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              activeTab === 'app_rbac'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>3. Generated Application Roles</span>
          </button>

          <button
            onClick={() => setActiveTab('platform_rbac')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              activeTab === 'platform_rbac'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>4. Floe Platform SaaS Roles</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              activeTab === 'simulator'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Interactive Governance Simulator</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Architecture & Non-Bypassable Production Gate */}
      {activeTab === 'architecture' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Hierarchy Chart */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Hierarchical Authorization Model</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800">
                  Level 1: Platform
                </span>
                <h5 className="text-sm font-bold text-white">FLOE SAAS</h5>
                <p className="text-[11px] text-slate-400">Floe Super Admin, Support, Auditor</p>
                <div className="text-[10px] text-slate-500 font-mono">Platform RBAC</div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/80 space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-indigo-300 px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700">
                  Level 2: Workspace
                </span>
                <h5 className="text-sm font-bold text-white">CUSTOMER ACCOUNT</h5>
                <p className="text-[11px] text-indigo-200">Owner, Admin, Builder, Approver</p>
                <div className="text-[10px] text-indigo-400 font-mono">Account RBAC</div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700">
                  Level 3: App
                </span>
                <h5 className="text-sm font-bold text-white">GENERATED APPS</h5>
                <p className="text-[11px] text-emerald-200">HR Admin, IT Agent, Requester</p>
                <div className="text-[10px] text-emerald-400 font-mono">Domain RBAC</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800">
                  Level 4: Data
                </span>
                <h5 className="text-sm font-bold text-white">RECORDS & AST</h5>
                <p className="text-[11px] text-slate-400">PostgreSQL DDL, RLS, Audit</p>
                <div className="text-[10px] text-slate-500 font-mono">Action Permissions</div>
              </div>
            </div>
          </div>

          {/* Non-Bypassable Production Deployment Pipeline */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Non-Bypassable Governance Gate (Deterministic + Human Sign-Off)</span>
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                Strict Zero-Trust Rule
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              In Floe, application authoring is strictly segregated from production authorization. Even an Account Admin or Application Builder cannot unilaterally push code directly to production without passing through the Human Governance Gate:
            </p>

            <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex-1 text-center p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-indigo-400 font-bold block">STEP 1</span>
                <strong className="text-white text-xs block mt-1">Application Builder</strong>
                <span className="text-[11px] text-slate-400 block mt-0.5">Prompt → IR → Sandbox Test</span>
              </div>

              <ArrowRight className="w-5 h-5 text-slate-600 hidden md:block shrink-0" />

              <div className="flex-1 text-center p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-sky-400 font-bold block">STEP 2</span>
                <strong className="text-white text-xs block mt-1">Production Plan</strong>
                <span className="text-[11px] text-slate-400 block mt-0.5">AST diff + Cost + SAST scan</span>
              </div>

              <ArrowRight className="w-5 h-5 text-slate-600 hidden md:block shrink-0" />

              <div className="flex-1 text-center p-3 rounded-lg bg-amber-950/40 border border-amber-700/80">
                <span className="text-[10px] text-amber-400 font-bold block">STEP 3 (GATE)</span>
                <strong className="text-amber-200 text-xs block mt-1">Production Approver</strong>
                <span className="text-[11px] text-amber-300/80 block mt-0.5">Reviews cost, security & signs off</span>
              </div>

              <ArrowRight className="w-5 h-5 text-slate-600 hidden md:block shrink-0" />

              <div className="flex-1 text-center p-3 rounded-lg bg-emerald-950/40 border border-emerald-700/80">
                <span className="text-[10px] text-emerald-400 font-bold block">STEP 4</span>
                <strong className="text-emerald-200 text-xs block mt-1">Deployment Manager</strong>
                <span className="text-[11px] text-emerald-300/80 block mt-0.5">Executes on Render / AWS</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Customer Account Roles (8 Core Roles) */}
      {activeTab === 'customer_rbac' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Customer Account Tier (Core MVP Roles)</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              {Object.keys(FLOE_CUSTOMER_ROLES).length} Standard Account Roles
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(FLOE_CUSTOMER_ROLES).map(role => (
              <div 
                key={role.id}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="font-bold text-white text-xs">{role.title}</h5>
                    <span className="text-[10px] text-slate-500 font-mono block">{role.id}</span>
                  </div>
                  {role.canApproveProduction ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                      Prod Approver
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-slate-400 border border-slate-800">
                      Standard
                    </span>
                  )}
                </div>

                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {role.purpose}
                </p>

                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Key Permissions:</span>
                  <div className="flex flex-wrap gap-1">
                    {role.keyPermissions.map(p => (
                      <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Generated Application Roles (Domain-Specific) */}
      {activeTab === 'app_rbac' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Application-Defined Domain Roles (Generated Dynamically)</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Tailored to business requirements (HR, IT, Finance)
            </span>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-white text-xs">Active Application Permission Matrix</span>
              <span className="text-[11px] text-slate-400 font-mono">{RBAC_PERMISSIONS_REGISTRY.length} Domain Scopes</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 text-[11px]">
                    <th className="p-3 font-semibold w-1/4">Domain Permission Scope</th>
                    <th className="p-3 font-semibold w-1/3">Description</th>
                    <th className="p-3 font-semibold text-center">Employee</th>
                    <th className="p-3 font-semibold text-center">Support Agent</th>
                    <th className="p-3 font-semibold text-center">Manager</th>
                    <th className="p-3 font-semibold text-center">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {RBAC_PERMISSIONS_REGISTRY.map((perm) => (
                    <tr key={perm.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-white block">{perm.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{perm.id}</span>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {perm.description}
                      </td>
                      {['employee', 'agent', 'manager', 'admin'].map((role) => {
                        const hasAccess = perm.allowedRoles.includes(role);
                        const isCurrentActive = currentUser.role === role;
                        return (
                          <td key={role} className={`p-3 text-center ${isCurrentActive ? 'bg-indigo-950/20' : ''}`}>
                            {hasAccess ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 mx-auto">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-slate-600 border border-slate-800 mx-auto">
                                <X className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Floe Platform SaaS Roles */}
      {activeTab === 'platform_rbac' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span>Floe SaaS Platform Operator Tier</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              For Floe platform infrastructure & vendor operations
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(FLOE_PLATFORM_ROLES).map(role => (
              <div 
                key={role.id}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
              >
                <div>
                  <h5 className="font-bold text-white text-xs">{role.title}</h5>
                  <span className="text-[10px] text-purple-400 font-mono block">{role.id}</span>
                </div>

                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {role.purpose}
                </p>

                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Key Permissions:</span>
                  <div className="flex flex-wrap gap-1">
                    {role.keyPermissions.map(p => (
                      <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 border border-purple-800">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Interactive Governance Simulator */}
      {activeTab === 'simulator' && (
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Zero-Trust Action Authorization Evaluator</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">AST Gate Middleware</span>
          </div>

          <p className="text-xs text-slate-400">
            Test how the Floe authorization engine validates high-stakes operations (e.g. promoting releases to production, managing billing, running migrations):
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1.5 font-medium">1. Select Subject / Customer Role</label>
              <select
                value={testCustomerRole}
                onChange={(e) => setTestCustomerRole(e.target.value as FloeCustomerRole)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                {Object.values(FLOE_CUSTOMER_ROLES).map(r => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 font-medium">2. Select Protected Action / Gate</label>
              <select
                value={testAction}
                onChange={(e) => setTestAction(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="release.promote">release.promote (Promote to Production)</option>
                <option value="application.generate">application.generate (Synthesize AST IR)</option>
                <option value="deployment.create">deployment.create (Trigger Cloud Deploy)</option>
                <option value="deployment.rollback">deployment.rollback (Rollback Production)</option>
                <option value="billing.manage">billing.manage (Modify Subscriptions & Billing)</option>
                <option value="ownership.transfer">ownership.transfer (Transfer Account Ownership)</option>
              </select>
            </div>
          </div>

          {/* Authorization Result */}
          <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
            currentEval.allowed
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/40 border-rose-800 text-rose-200'
          }`}>
            {currentEval.allowed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs">
                  {currentEval.allowed ? 'Status: 200 OK (AUTHORIZED)' : 'Status: 403 Forbidden (GOVERNANCE GATE BLOCKED)'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed font-mono">
                {currentEval.reason}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
