import { IntermediateRepresentation, Role, RoleUserCredential } from './floe';

export type UserRole = 
  | 'employee' 
  | 'agent' 
  | 'manager' 
  | 'admin' 
  | 'submitter' 
  | 'finance' 
  | 'hr_admin' 
  | 'it_manager' 
  | 'requester' 
  | 'auditor' 
  | string;

export interface RbacPermission {
  id: string;
  name: string;
  category: 'Entity Data' | 'Workflow Decision' | 'System & Governance';
  description: string;
  allowedRoles: string[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  avatar: string;
  balance?: number;
  totalAllowance?: number;
  assignedDomain?: string;
  token?: string;
  tokenExpiry?: string;
  permissions?: string[];
  description?: string;
  scopeBadge?: string;
  accentColor?: string;
}

export interface AppRoleDefinition {
  id: string;
  key: string;
  displayName: string;
  description: string;
  permissions: string[];
  user: AuthUser;
}

export const PRESET_USERS: Record<string, AuthUser> = {
  employee: {
    id: 'usr-emp-01',
    name: 'Alex Rivera',
    email: 'alex.rivera@floe.internal',
    password: 'AlexRivera#2026',
    role: 'employee',
    roleTitle: 'Software Engineer & Requester',
    department: 'Engineering & Product',
    avatar: 'AR',
    balance: 14,
    totalAllowance: 20,
    token: 'jwt_sec_emp_8832a71f09c',
    tokenExpiry: '8 hours',
    description: 'Standard end-user. Can submit new records, track status, and view own transaction history.',
    scopeBadge: 'read:own, create',
    accentColor: 'indigo'
  },
  agent: {
    id: 'usr-agt-02',
    name: 'Sarah Chen',
    email: 'sarah.chen@floe.internal',
    password: 'AgentSarah$2026',
    role: 'agent',
    roleTitle: 'Tier 2 Technical Specialist',
    department: 'IT & Service Operations',
    avatar: 'SC',
    token: 'jwt_sec_agt_9941b82e11d',
    tokenExpiry: '8 hours',
    description: 'Service desk operator. Can triage assigned queue, investigate issues, and update statuses.',
    scopeBadge: 'triage, update:status',
    accentColor: 'sky'
  },
  manager: {
    id: 'usr-mgr-03',
    name: 'Marcus Vance',
    email: 'marcus.vance@floe.internal',
    password: 'MarcusVance@2026',
    role: 'manager',
    roleTitle: 'Engineering Director & Approver',
    department: 'Engineering Leadership',
    avatar: 'MV',
    token: 'jwt_sec_mgr_7712c93a44f',
    tokenExpiry: '8 hours',
    description: 'Department approver. Can authorize Human Decision Gates, review quotas, and escalate.',
    scopeBadge: 'approve, override, review',
    accentColor: 'amber'
  },
  admin: {
    id: 'usr-adm-04',
    name: 'Elena Rostova',
    email: 'elena.rostova@floe.internal',
    password: 'AdminElena!2026',
    role: 'admin',
    roleTitle: 'Chief Information Security Officer (CISO)',
    department: 'InfoSec & Platform Infrastructure',
    avatar: 'ER',
    token: 'jwt_sec_adm_0023d88b99e',
    tokenExpiry: '8 hours',
    description: 'Full governance authority. Database DDL access, audit trails, and security matrix administration.',
    scopeBadge: 'all:admin, audit, ddl',
    accentColor: 'rose'
  }
};

/**
 * Intelligently generates domain-tailored roles and concrete user credentials (1 user per role)
 * for any generated application IR.
 */
export function getAppRolesAndUsers(ir?: IntermediateRepresentation): AppRoleDefinition[] {
  if (!ir) {
    return Object.entries(PRESET_USERS).map(([key, user]) => ({
      id: key,
      key,
      displayName: user.roleTitle.split('&')[0].trim(),
      description: user.description || 'Application user role',
      permissions: ['read:own', 'create'],
      user
    }));
  }

  const domain = (ir.domain || '').toLowerCase();
  const name = (ir.name || '').toLowerCase();

  // 1. Leave & Time-Off Management
  if (domain.includes('leave') || name.includes('leave') || name.includes('pto') || name.includes('time-off')) {
    return [
      {
        id: 'role-emp',
        key: 'employee',
        displayName: 'Employee (Requester)',
        description: 'Standard staff member. Can submit time-off requests and view leave balances.',
        permissions: ['create:LeaveRequest own', 'read:LeaveRequest own', 'read:Employee own'],
        user: {
          id: 'usr-leave-01',
          name: 'Alex Rivera',
          email: 'alex.rivera@floe.internal',
          password: 'AlexLeave#2026',
          role: 'employee',
          roleTitle: 'Software Engineer',
          department: 'Engineering & Product',
          avatar: 'AR',
          balance: 14,
          totalAllowance: 20,
          token: 'jwt_sec_emp_leave_8832',
          tokenExpiry: '8 hours',
          description: 'Staff member submitting leave requests and monitoring personal PTO balance.',
          scopeBadge: 'read:own, create',
          accentColor: 'indigo'
        }
      },
      {
        id: 'role-mgr',
        key: 'manager',
        displayName: 'Department Manager',
        description: 'Team lead with approval authority. Authorizes/rejects leave requests.',
        permissions: ['read:LeaveRequest team', 'update:LeaveRequest.status team', 'read:Employee team'],
        user: {
          id: 'usr-leave-02',
          name: 'Marcus Vance',
          email: 'marcus.vance@floe.internal',
          password: 'MarcusManager$2026',
          role: 'manager',
          roleTitle: 'Engineering Director & Approver',
          department: 'Engineering Leadership',
          avatar: 'MV',
          token: 'jwt_sec_mgr_leave_7712',
          tokenExpiry: '8 hours',
          description: 'Approves team requests and manages project continuity during leave periods.',
          scopeBadge: 'approve, team_read',
          accentColor: 'amber'
        }
      },
      {
        id: 'role-hr',
        key: 'hr_admin',
        displayName: 'HR & People Operations',
        description: 'HR Authority. Handles 48h timeout escalations, balance audits, and company policies.',
        permissions: ['read:LeaveRequest all', 'update:LeaveRequest.status all', 'read:Employee all', 'update:Employee.leave_balance_days all'],
        user: {
          id: 'usr-leave-03',
          name: 'Sophia Sterling',
          email: 'sophia.sterling@floe.internal',
          password: 'SophiaHR!2026',
          role: 'hr_admin',
          roleTitle: 'VP of People & HR Operations',
          department: 'People & Culture',
          avatar: 'SS',
          token: 'jwt_sec_hr_leave_4491',
          tokenExpiry: '8 hours',
          description: 'Oversees organizational PTO allocations, timeout escalations, and compliance.',
          scopeBadge: 'escalate, balance_all',
          accentColor: 'purple'
        }
      },
      {
        id: 'role-adm',
        key: 'admin',
        displayName: 'System Admin / CISO',
        description: 'Platform Administrator. Full PostgreSQL DDL access, audit logs, and security governance.',
        permissions: ['read:all', 'update:all', 'admin:ddl', 'admin:audit'],
        user: {
          id: 'usr-leave-04',
          name: 'Elena Rostova',
          email: 'elena.rostova@floe.internal',
          password: 'AdminElena!2026',
          role: 'admin',
          roleTitle: 'Chief Information Security Officer (CISO)',
          department: 'InfoSec & Infrastructure',
          avatar: 'ER',
          token: 'jwt_sec_adm_leave_0023',
          tokenExpiry: '8 hours',
          description: 'System superuser with access to PostgreSQL schema, audit logs, and encryption keys.',
          scopeBadge: 'all:admin, audit_logs',
          accentColor: 'rose'
        }
      }
    ];
  }

  // 2. Expense Reimbursement & Financial Claims
  if (domain.includes('expense') || name.includes('expense') || name.includes('reimburse') || name.includes('claim')) {
    return [
      {
        id: 'role-sub',
        key: 'submitter',
        displayName: 'Claim Submitter',
        description: 'Employee claiming business expenses, travel receipts, and meal allowances.',
        permissions: ['create:ExpenseClaim own', 'read:ExpenseClaim own'],
        user: {
          id: 'usr-exp-01',
          name: 'David Kim',
          email: 'david.kim@floe.internal',
          password: 'DavidExp#2026',
          role: 'submitter',
          roleTitle: 'Senior Field Solutions Architect',
          department: 'Client Solutions & Sales',
          avatar: 'DK',
          balance: 850,
          totalAllowance: 5000,
          token: 'jwt_sec_sub_exp_3319',
          tokenExpiry: '8 hours',
          description: 'Submits receipts and tracks expense disbursement status.',
          scopeBadge: 'create:claim, read:own',
          accentColor: 'emerald'
        }
      },
      {
        id: 'role-mgr',
        key: 'manager',
        displayName: 'Cost Center Manager',
        description: 'Budget approver. Reviews claims against departmental quarterly budgets.',
        permissions: ['read:ExpenseClaim team', 'update:ExpenseClaim.status team'],
        user: {
          id: 'usr-exp-02',
          name: 'Rachel Green',
          email: 'rachel.green@floe.internal',
          password: 'RachelBudget$2026',
          role: 'manager',
          roleTitle: 'VP of Commercial Operations',
          department: 'Commercial Leadership',
          avatar: 'RG',
          token: 'jwt_sec_mgr_exp_8820',
          tokenExpiry: '8 hours',
          description: 'Validates receipt legitimacy and authorizes payouts within department cap.',
          scopeBadge: 'approve:budget, team_read',
          accentColor: 'amber'
        }
      },
      {
        id: 'role-fin',
        key: 'finance',
        displayName: 'Finance & Compliance Auditor',
        description: 'Corporate Finance. Audits AI policy flags, duplicates, and initiates wire reimbursements.',
        permissions: ['read:ExpenseClaim all', 'update:ExpenseClaim.status all', 'audit:policy all'],
        user: {
          id: 'usr-exp-03',
          name: 'Siddharth Nair',
          email: 'siddharth.nair@floe.internal',
          password: 'FinanceAudit!2026',
          role: 'finance',
          roleTitle: 'Senior Corporate Financial Controller',
          department: 'Treasury & Accounts Payable',
          avatar: 'SN',
          token: 'jwt_sec_fin_exp_9912',
          tokenExpiry: '8 hours',
          description: 'Conducts compliance auditing and triggers automated ACH/wire disbursements.',
          scopeBadge: 'audit:finance, reimburse_all',
          accentColor: 'teal'
        }
      },
      {
        id: 'role-adm',
        key: 'admin',
        displayName: 'ERP Platform Administrator',
        description: 'Global Finance System Administrator. Manages ERP connectors and audit logs.',
        permissions: ['read:all', 'update:all', 'admin:ddl', 'admin:audit'],
        user: {
          id: 'usr-exp-04',
          name: 'Elena Rostova',
          email: 'elena.rostova@floe.internal',
          password: 'AdminElena!2026',
          role: 'admin',
          roleTitle: 'Chief Information Security Officer (CISO)',
          department: 'InfoSec & ERP Infrastructure',
          avatar: 'ER',
          token: 'jwt_sec_adm_exp_0023',
          tokenExpiry: '8 hours',
          description: 'ERP integration lead with full audit trail access and security governance.',
          scopeBadge: 'all:admin, audit_logs',
          accentColor: 'rose'
        }
      }
    ];
  }

  // 3. IT Service Desk & ITSM Incident Management
  if (domain.includes('itsm') || domain.includes('service') || name.includes('ticket') || name.includes('helpdesk') || name.includes('service')) {
    return [
      {
        id: 'role-emp',
        key: 'employee',
        displayName: 'Employee (Requester)',
        description: 'Staff member creating IT tickets, hardware requests, and viewing SLA status.',
        permissions: ['create:ITTicket own', 'read:ITTicket own', 'create:TicketComment own'],
        user: {
          id: 'usr-itsm-01',
          name: 'Alex Rivera',
          email: 'alex.rivera@floe.internal',
          password: 'AlexTech#2026',
          role: 'employee',
          roleTitle: 'Software Engineer',
          department: 'Engineering & Product',
          avatar: 'AR',
          token: 'jwt_sec_emp_itsm_1192',
          tokenExpiry: '8 hours',
          description: 'Submits technical issues, attaches diagnostic logs, and monitors resolution SLAs.',
          scopeBadge: 'create:ticket, read:own',
          accentColor: 'indigo'
        }
      },
      {
        id: 'role-agt',
        key: 'agent',
        displayName: 'Tier 2 Support Specialist',
        description: 'Service Desk Operator. Triages queue, investigates root cause, updates status, and comments.',
        permissions: ['read:ITTicket all', 'update:ITTicket.status assigned', 'create:TicketComment internal'],
        user: {
          id: 'usr-itsm-02',
          name: 'Sarah Chen',
          email: 'sarah.chen@floe.internal',
          password: 'AgentSarah$2026',
          role: 'agent',
          roleTitle: 'Tier 2 Support Engineer',
          department: 'IT Service Operations',
          avatar: 'SC',
          token: 'jwt_sec_agt_itsm_7741',
          tokenExpiry: '8 hours',
          description: 'Investigates and resolves user incident tickets, manages triage queue.',
          scopeBadge: 'triage, resolve, internal_notes',
          accentColor: 'sky'
        }
      },
      {
        id: 'role-mgr',
        key: 'manager',
        displayName: 'IT Operations Lead',
        description: 'Service Desk Manager. Manages SLA escalations, assigns queues, and approves software.',
        permissions: ['read:ITTicket all', 'update:ITTicket.sla all', 'approve:AccessRequest all'],
        user: {
          id: 'usr-itsm-03',
          name: 'Marcus Vance',
          email: 'marcus.vance@floe.internal',
          password: 'ManagerMarcus@2026',
          role: 'manager',
          roleTitle: 'Director of IT Infrastructure',
          department: 'IT & Cloud Operations',
          avatar: 'MV',
          token: 'jwt_sec_mgr_itsm_8820',
          tokenExpiry: '8 hours',
          description: 'Monitors SLA adherence metrics and authorizes high-tier access requests.',
          scopeBadge: 'override_sla, reassign_all',
          accentColor: 'amber'
        }
      },
      {
        id: 'role-adm',
        key: 'admin',
        displayName: 'CISO / Platform Admin',
        description: 'Security & Systems Administrator. Configures SSO, audit logging, and RBAC matrix.',
        permissions: ['read:all', 'update:all', 'admin:ddl', 'admin:audit'],
        user: {
          id: 'usr-itsm-04',
          name: 'Elena Rostova',
          email: 'elena.rostova@floe.internal',
          password: 'AdminElena!2026',
          role: 'admin',
          roleTitle: 'Chief Information Security Officer (CISO)',
          department: 'InfoSec & Infrastructure',
          avatar: 'ER',
          token: 'jwt_sec_adm_itsm_0023',
          tokenExpiry: '8 hours',
          description: 'Global infrastructure administrator with access to live security telemetry.',
          scopeBadge: 'all:admin, audit_logs',
          accentColor: 'rose'
        }
      }
    ];
  }

  // 4. IT Hardware & Equipment Procurement
  if (domain.includes('equipment') || name.includes('equipment') || name.includes('hardware') || name.includes('asset')) {
    return [
      {
        id: 'role-req',
        key: 'requester',
        displayName: 'Hardware Requester',
        description: 'Staff member requesting workstations, monitors, laptops, and peripheral kits.',
        permissions: ['create:EquipmentRequest own', 'read:EquipmentRequest own'],
        user: {
          id: 'usr-equip-01',
          name: 'Chloe Bennett',
          email: 'chloe.bennett@floe.internal',
          password: 'ChloeDev#2026',
          role: 'requester',
          roleTitle: 'Lead UX Designer',
          department: 'Product & Design',
          avatar: 'CB',
          token: 'jwt_sec_req_equip_9931',
          tokenExpiry: '8 hours',
          description: 'Requests hardware upgrades and monitors procurement tracking.',
          scopeBadge: 'create:request, read:own',
          accentColor: 'indigo'
        }
      },
      {
        id: 'role-it-mgr',
        key: 'it_manager',
        displayName: 'IT Procurement Manager',
        description: 'Hardware Asset Manager. Evaluates vendor inventory, quotes, and approves deliveries.',
        permissions: ['read:EquipmentRequest all', 'update:EquipmentRequest.status all'],
        user: {
          id: 'usr-equip-02',
          name: 'Liam Scott',
          email: 'liam.scott@floe.internal',
          password: 'LiamProcure$2026',
          role: 'it_manager',
          roleTitle: 'IT Procurement & Asset Lead',
          department: 'IT Asset Management',
          avatar: 'LS',
          token: 'jwt_sec_mgr_equip_5521',
          tokenExpiry: '8 hours',
          description: 'Coordinates bulk supplier orders and fulfills developer workstation kits.',
          scopeBadge: 'approve:procurement, manage:inventory',
          accentColor: 'amber'
        }
      },
      {
        id: 'role-adm',
        key: 'admin',
        displayName: 'Asset & Platform Admin',
        description: 'Global Asset Administrator. Oversees depreciation models and serial registry.',
        permissions: ['read:all', 'update:all', 'admin:ddl', 'admin:audit'],
        user: {
          id: 'usr-equip-03',
          name: 'Elena Rostova',
          email: 'elena.rostova@floe.internal',
          password: 'AdminElena!2026',
          role: 'admin',
          roleTitle: 'Chief Information Security Officer (CISO)',
          department: 'InfoSec & Asset Registry',
          avatar: 'ER',
          token: 'jwt_sec_adm_equip_0023',
          tokenExpiry: '8 hours',
          description: 'Audits hardware custody chains and enforces physical security compliance.',
          scopeBadge: 'all:admin, audit_logs',
          accentColor: 'rose'
        }
      }
    ];
  }

  // 5. If IR has explicit custom roles defined by the user / requirements engine
  if (ir.roles && ir.roles.length > 0) {
    const accentColors = ['indigo', 'sky', 'amber', 'purple', 'teal', 'rose'];
    const namesList = [
      { name: 'Alex Rivera', emailPrefix: 'alex.rivera', title: 'Specialist & Submitter', dept: 'Operations & Engineering' },
      { name: 'Sarah Chen', emailPrefix: 'sarah.chen', title: 'Domain Lead & Operator', dept: 'Workflow Operations' },
      { name: 'Marcus Vance', emailPrefix: 'marcus.vance', title: 'Department Director & Approver', dept: 'Management Leadership' },
      { name: 'Elena Rostova', emailPrefix: 'elena.rostova', title: 'System Administrator & CISO', dept: 'Platform Governance' },
      { name: 'David Kim', emailPrefix: 'david.kim', title: 'Senior Auditor', dept: 'Quality & Compliance' }
    ];

    return ir.roles.map((r, idx) => {
      const fallback = namesList[idx % namesList.length];
      const roleKey = r.name.toLowerCase().replace(/\s+/g, '_');
      const cleanTitle = r.displayName || r.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      const userPersona: AuthUser = {
        id: `usr-gen-${idx + 1}`,
        name: r.userPersona?.name || fallback.name,
        email: r.userPersona?.email || `${fallback.emailPrefix}@floe.internal`,
        password: r.userPersona?.password || `${fallback.name.split(' ')[0]}Pass#2026!`,
        role: roleKey,
        roleTitle: r.userPersona?.roleTitle || (idx === 0 ? `Staff ${cleanTitle}` : idx === ir.roles.length - 1 ? `Chief ${cleanTitle}` : `Lead ${cleanTitle}`),
        department: r.userPersona?.department || fallback.dept,
        avatar: (r.userPersona?.name || fallback.name).split(' ').map(n => n[0]).join('').toUpperCase(),
        token: `jwt_sec_gen_${roleKey}_${idx + 100}`,
        tokenExpiry: '8 hours',
        description: r.description || `Authorized persona for ${cleanTitle} workflow.`,
        scopeBadge: r.permissions.slice(0, 2).join(', ') || 'standard:access',
        accentColor: accentColors[idx % accentColors.length]
      };

      return {
        id: `role-${roleKey}`,
        key: roleKey,
        displayName: cleanTitle,
        description: r.description || `Role authorized to execute ${cleanTitle} workflows.`,
        permissions: r.permissions,
        user: userPersona
      };
    });
  }

  // 6. Generic Default Fallback for custom / novel domains
  return [
    {
      id: 'role-user',
      key: 'employee',
      displayName: 'Standard User (Submitter)',
      description: `Primary end-user persona for ${ir.name}. Can create and track records.`,
      permissions: ['create:record own', 'read:record own'],
      user: {
        id: 'usr-gen-01',
        name: 'Alex Rivera',
        email: 'alex.rivera@floe.internal',
        password: 'AlexUser#2026',
        role: 'employee',
        roleTitle: 'Operations Analyst',
        department: 'Operations & Staff',
        avatar: 'AR',
        token: 'jwt_sec_gen_user_1',
        tokenExpiry: '8 hours',
        description: `Creates submissions and monitors workflows in ${ir.name}.`,
        scopeBadge: 'read:own, create',
        accentColor: 'indigo'
      }
    },
    {
      id: 'role-specialist',
      key: 'agent',
      displayName: 'Domain Specialist / Operator',
      description: 'Reviews active items, updates statuses, and handles operational workflows.',
      permissions: ['read:record all', 'update:record.status assigned'],
      user: {
        id: 'usr-gen-02',
        name: 'Sarah Chen',
        email: 'sarah.chen@floe.internal',
        password: 'SarahSpecialist$2026',
        role: 'agent',
        roleTitle: 'Senior Workflow Specialist',
        department: 'Service Delivery',
        avatar: 'SC',
        token: 'jwt_sec_gen_agent_2',
        tokenExpiry: '8 hours',
        description: 'Processes incoming queues and updates status in real-time.',
        scopeBadge: 'triage, update_status',
        accentColor: 'sky'
      }
    },
    {
      id: 'role-approver',
      key: 'manager',
      displayName: 'Approving Manager',
      description: 'Department Lead. Reviews thresholds, approves decisions, and handles escalations.',
      permissions: ['read:record all', 'approve:decision all', 'update:record all'],
      user: {
        id: 'usr-gen-03',
        name: 'Marcus Vance',
        email: 'marcus.vance@floe.internal',
        password: 'MarcusLead@2026',
        role: 'manager',
        roleTitle: 'Department Director & Approver',
        department: 'Executive Management',
        avatar: 'MV',
        token: 'jwt_sec_gen_mgr_3',
        tokenExpiry: '8 hours',
        description: 'Human decision reviewer for high-value workflow gates and policy overrides.',
        scopeBadge: 'approve, override',
        accentColor: 'amber'
      }
    },
    {
      id: 'role-admin',
      key: 'admin',
      displayName: 'System Admin / CISO',
      description: 'Platform Superuser. Full PostgreSQL DDL access, audit logs, and security governance.',
      permissions: ['read:all', 'update:all', 'admin:ddl', 'admin:audit'],
      user: {
        id: 'usr-gen-04',
        name: 'Elena Rostova',
        email: 'elena.rostova@floe.internal',
        password: 'AdminElena!2026',
        role: 'admin',
        roleTitle: 'Chief Information Security Officer (CISO)',
        department: 'InfoSec & Governance',
        avatar: 'ER',
        token: 'jwt_sec_gen_adm_4',
        tokenExpiry: '8 hours',
        description: 'Superuser with unrestricted access to database schemas, audit logs, and keys.',
        scopeBadge: 'all:admin, audit_logs',
        accentColor: 'rose'
      }
    }
  ];
}

/**
 * Returns a dictionary of AuthUser keyed by role identifier.
 */
export function getAppRolePersonas(ir?: IntermediateRepresentation): Record<string, AuthUser> {
  const roles = getAppRolesAndUsers(ir);
  const result: Record<string, AuthUser> = {};
  roles.forEach(r => {
    result[r.key] = r.user;
  });
  return result;
}

export const RBAC_PERMISSIONS_REGISTRY: RbacPermission[] = [
  {
    id: 'req:create',
    name: 'Create Submissions',
    category: 'Entity Data',
    description: 'Submit new leave requests, expense claims, or IT service tickets.',
    allowedRoles: ['employee', 'agent', 'manager', 'admin', 'submitter', 'requester']
  },
  {
    id: 'req:read_own',
    name: 'Read Own Records',
    category: 'Entity Data',
    description: 'View personally submitted transactions and active status.',
    allowedRoles: ['employee', 'agent', 'manager', 'admin', 'submitter', 'requester', 'finance', 'hr_admin', 'it_manager']
  },
  {
    id: 'req:read_all',
    name: 'Read All Records',
    category: 'Entity Data',
    description: 'Access organization-wide records across all departments.',
    allowedRoles: ['agent', 'manager', 'admin', 'finance', 'hr_admin', 'it_manager', 'auditor']
  },
  {
    id: 'wf:triage',
    name: 'Triage & Update Status',
    category: 'Workflow Decision',
    description: 'Assign tickets, modify status (In Progress, Waiting, Resolved), and add internal tech notes.',
    allowedRoles: ['agent', 'admin', 'it_manager']
  },
  {
    id: 'wf:approve_reject',
    name: 'Approve & Reject Gate',
    category: 'Workflow Decision',
    description: 'Approve or reject requests at Human Gate nodes, mutating balances & state.',
    allowedRoles: ['manager', 'admin', 'finance', 'hr_admin', 'it_manager']
  },
  {
    id: 'wf:override_sla',
    name: 'Override SLA & Escalate',
    category: 'Workflow Decision',
    description: 'Manually adjust SLA target timers or re-route escalated tickets.',
    allowedRoles: ['manager', 'admin', 'hr_admin']
  },
  {
    id: 'sys:audit_logs',
    name: 'Access Audit & DDL Logs',
    category: 'System & Governance',
    description: 'Query runtime PostgreSQL transaction logs, state mutations, and health metrics.',
    allowedRoles: ['admin', 'finance', 'auditor']
  },
  {
    id: 'sys:rbac_manage',
    name: 'Manage RBAC & User Policies',
    category: 'System & Governance',
    description: 'Modify role permission matrices, assign roles, and revoke session tokens.',
    allowedRoles: ['admin']
  }
];

export function checkPermission(userRole: string, permissionId: string): boolean {
  const perm = RBAC_PERMISSIONS_REGISTRY.find(p => p.id === permissionId);
  if (!perm) return false;
  return perm.allowedRoles.includes(userRole) || userRole === 'admin';
}

// ============================================================================
// 1. FLOE PLATFORM ROLES (Controls the Floe SaaS Platform itself)
// ============================================================================
export type FloePlatformRole = 
  | 'floe_super_admin'
  | 'floe_platform_admin'
  | 'floe_security_admin'
  | 'floe_devops_admin'
  | 'floe_support'
  | 'floe_auditor';

export interface FloePlatformRoleDef {
  id: FloePlatformRole;
  title: string;
  category: 'Platform Tier' | 'Customer Account Tier';
  purpose: string;
  keyPermissions: string[];
}

export const FLOE_PLATFORM_ROLES: Record<FloePlatformRole, FloePlatformRoleDef> = {
  floe_super_admin: {
    id: 'floe_super_admin',
    title: 'Floe Super Admin',
    category: 'Platform Tier',
    purpose: 'Full platform administration across all tenants, cloud providers, and system telemetry.',
    keyPermissions: ['platform:all', 'tenant:manage', 'cloud:infrastructure', 'billing:global', 'security:override']
  },
  floe_platform_admin: {
    id: 'floe_platform_admin',
    title: 'Floe Platform Admin',
    category: 'Platform Tier',
    purpose: 'Operate Floe SaaS platform: users, workspaces, deployments, providers, and engine configs.',
    keyPermissions: ['platform:operate', 'workspaces:manage', 'providers:configure', 'deployments:monitor']
  },
  floe_security_admin: {
    id: 'floe_security_admin',
    title: 'Floe Security Admin',
    category: 'Platform Tier',
    purpose: 'Security & compliance: policies, security findings, audit, secrets, approvals.',
    keyPermissions: ['security:read', 'security:override', 'audit:read', 'secrets:inspect', 'compliance:enforce']
  },
  floe_devops_admin: {
    id: 'floe_devops_admin',
    title: 'Floe DevOps Admin',
    category: 'Platform Tier',
    purpose: 'Infrastructure & deployments: CI/CD, Render, AWS/Azure/GCP, deployments, and rollbacks.',
    keyPermissions: ['deployment:create', 'deployment:rollback', 'infrastructure:manage', 'render:provision']
  },
  floe_support: {
    id: 'floe_support',
    title: 'Floe Support Admin',
    category: 'Platform Tier',
    purpose: 'Customer support: view customer systems, diagnostics, and sandbox logs with limited mutation.',
    keyPermissions: ['support:view_logs', 'diagnostics:run', 'sandbox:inspect']
  },
  floe_auditor: {
    id: 'floe_auditor',
    title: 'Floe Auditor',
    category: 'Platform Tier',
    purpose: 'Read-only compliance: audit logs, releases, approvals, and immutable deployment history.',
    keyPermissions: ['audit:read_all', 'releases:audit_history', 'compliance:export']
  }
};

// ============================================================================
// 2. CUSTOMER / ACCOUNT ROLES (Controls a Customer's Floe Workspace)
// ============================================================================
export type FloeCustomerRole = 
  | 'account_owner'
  | 'account_admin'
  | 'application_builder'
  | 'deployment_manager'
  | 'production_approver'
  | 'security_admin'
  | 'application_operator'
  | 'analyst'
  | 'viewer';

export interface FloeCustomerRoleDef {
  id: FloeCustomerRole;
  title: string;
  category: 'Customer Account Tier';
  purpose: string;
  canApproveProduction: boolean;
  keyPermissions: string[];
}

export const FLOE_CUSTOMER_ROLES: Record<FloeCustomerRole, FloeCustomerRoleDef> = {
  account_owner: {
    id: 'account_owner',
    title: 'Account Owner',
    category: 'Customer Account Tier',
    purpose: 'Owns the Floe subscription/account. Manages billing, security settings, user provisioning, and enterprise ownership.',
    canApproveProduction: true,
    keyPermissions: ['billing:manage', 'user:manage', 'role:manage', 'release:promote', 'security:manage', 'ownership:transfer']
  },
  account_admin: {
    id: 'account_admin',
    title: 'Account Admin',
    category: 'Customer Account Tier',
    purpose: 'Operational administrator. Configures applications, manages users/roles, and requests deployments (no direct prod bypass).',
    canApproveProduction: false,
    keyPermissions: ['application:create', 'application:update', 'user:manage', 'role:manage', 'environment:sandbox.manage', 'deployment:request']
  },
  application_builder: {
    id: 'application_builder',
    title: 'Application Builder',
    category: 'Customer Account Tier',
    purpose: 'Enters requirements, runs AI pipeline, generates deterministic AST, tests workflows, and submits to Production Approver.',
    canApproveProduction: false,
    keyPermissions: ['requirements:create', 'requirements:update', 'release:generate', 'release:test', 'environment:sandbox.manage']
  },
  deployment_manager: {
    id: 'deployment_manager',
    title: 'Deployment Manager',
    category: 'Customer Account Tier',
    purpose: 'Executes approved deployment plans on Render/Cloud, manages test environments, and triggers deterministic rollbacks.',
    canApproveProduction: false,
    keyPermissions: ['deployment:create', 'deployment:read', 'deployment:rollback', 'infrastructure:read', 'logs:view']
  },
  production_approver: {
    id: 'production_approver',
    title: 'Production Approver',
    category: 'Customer Account Tier',
    purpose: 'Key governance gate: reviews architecture, security scan results, estimated costs, and authorizes production promotion.',
    canApproveProduction: true,
    keyPermissions: ['architecture:read', 'cost:estimate', 'security:read', 'release:promote', 'governance:signoff']
  },
  security_admin: {
    id: 'security_admin',
    title: 'Security Admin',
    category: 'Customer Account Tier',
    purpose: 'Reviews SAST/DAST, SBOM, secrets findings, configures security thresholds, and manages policy exceptions.',
    canApproveProduction: false,
    keyPermissions: ['security:read', 'security:override', 'sbom:inspect', 'secrets:audit', 'policy:configure']
  },
  application_operator: {
    id: 'application_operator',
    title: 'Application Operator',
    category: 'Customer Account Tier',
    purpose: 'Operates live deployed applications: health monitoring, service restarts, metric dashboards, and incident acknowledgments.',
    canApproveProduction: false,
    keyPermissions: ['application:health_view', 'services:restart', 'metrics:read', 'incidents:acknowledge']
  },
  analyst: {
    id: 'analyst',
    title: 'Analyst',
    category: 'Customer Account Tier',
    purpose: 'Queries application data, creates cross-functional reports, and utilizes conversational analytics without production mutation.',
    canApproveProduction: false,
    keyPermissions: ['analytics:query', 'reports:create', 'dashboards:view', 'data:read_aggregated']
  },
  viewer: {
    id: 'viewer',
    title: 'Viewer',
    category: 'Customer Account Tier',
    purpose: 'Read-only stakeholder access to applications, generated workflows, staging previews, and basic dashboards.',
    canApproveProduction: false,
    keyPermissions: ['application:read', 'dashboards:view', 'architecture:read']
  }
};

export interface FloeStudioUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: FloePlatformRole | FloeCustomerRole | string;
  roleTitle: string;
  roleType: 'platform' | 'customer';
  organization: string;
  avatar: string;
  tier: 'Enterprise Suite' | 'Professional Builder' | 'Startup Team' | 'Community Free';
  permissions: string[];
  token: string;
  tokenExpiry: string;
  avatarColor: string;
  department?: string;
  canApproveProduction?: boolean;
  stats?: {
    appsCreated: number;
    workflowsDeployed: number;
    agentsRun: number;
  };
}

export const FLOE_STUDIO_PERSONAS: FloeStudioUser[] = [
  // ============================================================================
  // CUSTOMER / ACCOUNT TIER USERS (Enterprise Global Workspace)
  // ============================================================================
  {
    id: 'floe-usr-owner',
    name: 'Gaurav Saraswat',
    email: 'gaurav.saraswats@floe.internal',
    password: 'FloeOwner#2026',
    role: 'account_owner',
    roleTitle: 'Account Owner (Founder / Enterprise Admin)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'GS',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-indigo-600',
    department: 'Executive Leadership & Governance',
    canApproveProduction: true,
    permissions: ['billing:manage', 'user:manage', 'role:manage', 'release:promote', 'security:manage', 'ownership:transfer'],
    token: 'floe_sec_jwt_owner_884920b1',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 16,
      workflowsDeployed: 42,
      agentsRun: 290
    }
  },
  {
    id: 'floe-usr-admin',
    name: 'David Sterling',
    email: 'david.sterling@floe.internal',
    password: 'AdminOps#2026',
    role: 'account_admin',
    roleTitle: 'Account Admin (Workspace Operations)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'DS',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-blue-600',
    department: 'Workspace Administration',
    canApproveProduction: false,
    permissions: ['application:create', 'application:update', 'user:manage', 'role:manage', 'environment:sandbox.manage', 'deployment:request'],
    token: 'floe_sec_jwt_admin_332190f8',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 12,
      workflowsDeployed: 34,
      agentsRun: 210
    }
  },
  {
    id: 'floe-usr-builder',
    name: 'Alex Rivera',
    email: 'alex.rivera@floe.internal',
    password: 'FloeBuilder#2026',
    role: 'application_builder',
    roleTitle: 'Application Builder (No-Code AI)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'AR',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-emerald-600',
    department: 'Digital Workplace Solutions',
    canApproveProduction: false,
    permissions: ['requirements:create', 'requirements:update', 'release:generate', 'release:test', 'environment:sandbox.manage'],
    token: 'floe_sec_jwt_builder_991822c4',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 14,
      workflowsDeployed: 28,
      agentsRun: 235
    }
  },
  {
    id: 'floe-usr-approver',
    name: 'Marcus Vance',
    email: 'marcus.vance@floe.internal',
    password: 'MarcusApprover@2026',
    role: 'production_approver',
    roleTitle: 'Production Approver (Governance Gate)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'MV',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-amber-600',
    department: 'Architecture & Change Advisory Board',
    canApproveProduction: true,
    permissions: ['architecture:read', 'cost:estimate', 'security:read', 'release:promote', 'governance:signoff'],
    token: 'floe_sec_jwt_approver_771944a2',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 4,
      workflowsDeployed: 31,
      agentsRun: 154
    }
  },
  {
    id: 'floe-usr-deployer',
    name: 'Sarah Chen',
    email: 'sarah.chen@floe.internal',
    password: 'SarahDeploy!2026',
    role: 'deployment_manager',
    roleTitle: 'Deployment Manager (Cloud & Render)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'SC',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-sky-600',
    department: 'Cloud Platform & Infrastructure',
    canApproveProduction: false,
    permissions: ['deployment:create', 'deployment:read', 'deployment:rollback', 'infrastructure:read'],
    token: 'floe_sec_jwt_deploy_550198e3',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 2,
      workflowsDeployed: 48,
      agentsRun: 190
    }
  },
  {
    id: 'floe-usr-secadmin',
    name: 'Rachel Adams',
    email: 'rachel.adams@floe.internal',
    password: 'RachelSec#2026',
    role: 'security_admin',
    roleTitle: 'Security Admin (AppSec & Compliance)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'RA',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-rose-600',
    department: 'Information Security & AppSec',
    canApproveProduction: false,
    permissions: ['security:read', 'security:override', 'sbom:inspect', 'secrets:audit', 'policy:configure'],
    token: 'floe_sec_jwt_secadmin_441209e1',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 1,
      workflowsDeployed: 12,
      agentsRun: 110
    }
  },
  {
    id: 'floe-usr-operator',
    name: 'Kenji Sato',
    email: 'kenji.sato@floe.internal',
    password: 'KenjiOps#2026',
    role: 'application_operator',
    roleTitle: 'Application Operator (Site Reliability)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'KS',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-teal-600',
    department: 'Production Operations & SRE',
    canApproveProduction: false,
    permissions: ['application:health_view', 'services:restart', 'metrics:read', 'incidents:acknowledge'],
    token: 'floe_sec_jwt_operator_229910d5',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 0,
      workflowsDeployed: 15,
      agentsRun: 85
    }
  },
  {
    id: 'floe-usr-analyst',
    name: 'Maya Patel',
    email: 'maya.patel@floe.internal',
    password: 'MayaAnalyst$2026',
    role: 'analyst',
    roleTitle: 'Business Analyst (Reporting & AI Analytics)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'MP',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-violet-600',
    department: 'Enterprise Data & Analytics',
    canApproveProduction: false,
    permissions: ['analytics:query', 'reports:create', 'dashboards:view', 'data:read_aggregated'],
    token: 'floe_sec_jwt_analyst_119022c3',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 2,
      workflowsDeployed: 0,
      agentsRun: 140
    }
  },
  {
    id: 'floe-usr-viewer',
    name: 'Oliver Vance',
    email: 'oliver.vance@floe.internal',
    password: 'OliverViewer#2026',
    role: 'viewer',
    roleTitle: 'Workspace Stakeholder (Read-Only)',
    roleType: 'customer',
    organization: 'Enterprise Global',
    avatar: 'OV',
    tier: 'Community Free',
    avatarColor: 'bg-slate-600',
    department: 'Business Stakeholders',
    canApproveProduction: false,
    permissions: ['application:read', 'dashboards:view', 'architecture:read'],
    token: 'floe_sec_jwt_viewer_990182a4',
    tokenExpiry: '12 hours',
    stats: {
      appsCreated: 0,
      workflowsDeployed: 0,
      agentsRun: 8
    }
  },

  // ============================================================================
  // FLOE PLATFORM SAAS TIER USERS (Floe Systems Vendor Operations)
  // ============================================================================
  {
    id: 'floe-usr-superadmin',
    name: 'Elena Rostova',
    email: 'elena.rostova@floe.platform',
    password: 'FloeSuperAdmin!2026',
    role: 'floe_super_admin',
    roleTitle: 'Floe Super Admin (Platform Operator)',
    roleType: 'platform',
    organization: 'Floe Systems Inc (SaaS Vendor)',
    avatar: 'ER',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-purple-600',
    department: 'Floe Core SaaS Infrastructure',
    canApproveProduction: true,
    permissions: ['platform:all', 'tenant:manage', 'cloud:infrastructure', 'billing:global', 'security:override'],
    token: 'floe_sec_jwt_super_001923a',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 52,
      workflowsDeployed: 140,
      agentsRun: 1100
    }
  },
  {
    id: 'floe-usr-platformadmin',
    name: 'Vikram Joshi',
    email: 'vikram.joshi@floe.platform',
    password: 'VikramPlatAdmin#2026',
    role: 'floe_platform_admin',
    roleTitle: 'Floe Platform Admin (Multi-Tenant Ops)',
    roleType: 'platform',
    organization: 'Floe Systems Inc (SaaS Vendor)',
    avatar: 'VJ',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-fuchsia-600',
    department: 'SaaS Platform Operations',
    canApproveProduction: false,
    permissions: ['platform:operate', 'workspaces:manage', 'providers:configure', 'deployments:monitor'],
    token: 'floe_sec_jwt_platadmin_778102a1',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 24,
      workflowsDeployed: 95,
      agentsRun: 620
    }
  },
  {
    id: 'floe-usr-support',
    name: 'Zoe Martinez',
    email: 'support.tier2@floe.platform',
    password: 'FloeSupport#2026',
    role: 'floe_support',
    roleTitle: 'Floe Support Admin (Diagnostics & Triage)',
    roleType: 'platform',
    organization: 'Floe Systems Inc (SaaS Vendor)',
    avatar: 'ZM',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-blue-600',
    department: 'Customer Success & Technical Support',
    canApproveProduction: false,
    permissions: ['support:view_logs', 'diagnostics:run', 'sandbox:inspect'],
    token: 'floe_sec_jwt_support_441098',
    tokenExpiry: '12 hours',
    stats: {
      appsCreated: 0,
      workflowsDeployed: 0,
      agentsRun: 75
    }
  },
  {
    id: 'floe-usr-auditor',
    name: 'Arthur Pendelton',
    email: 'arthur.auditor@floe.platform',
    password: 'AuditorCompliance#2026',
    role: 'floe_auditor',
    roleTitle: 'Floe Compliance Auditor (Read-Only Audit)',
    roleType: 'platform',
    organization: 'Floe Systems Inc (SaaS Vendor)',
    avatar: 'AP',
    tier: 'Enterprise Suite',
    avatarColor: 'bg-slate-700',
    department: 'SOC2 & ISO Compliance Audit',
    canApproveProduction: false,
    permissions: ['audit:read_all', 'releases:audit_history', 'compliance:export'],
    token: 'floe_sec_jwt_auditor_991823d7',
    tokenExpiry: '24 hours',
    stats: {
      appsCreated: 0,
      workflowsDeployed: 0,
      agentsRun: 18
    }
  }
];

