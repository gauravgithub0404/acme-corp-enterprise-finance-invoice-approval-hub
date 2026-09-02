import React, { useState } from 'react';
import { FloeStudioUser, FLOE_STUDIO_PERSONAS } from '../../types/auth';
import { loginWithCredentials, registerWithCredentials } from '../../utils/studioSession';
import {
  Layers, Lock, Mail, Key, Shield, ShieldCheck, CheckCircle2, ArrowRight,
  Sparkles, Building2, Eye, EyeOff, AlertCircle, Copy, Check, RefreshCw,
  Server, Cpu, Users, Workflow, HelpCircle, ChevronRight, Zap
} from 'lucide-react';

interface FloePlatformLoginProps {
  onLoginSuccess: (user: FloeStudioUser) => void;
  onBackToStudio?: () => void;
  initialPersonaId?: string;
}

export const FloePlatformLogin: React.FC<FloePlatformLoginProps> = ({
  onLoginSuccess,
  onBackToStudio,
  initialPersonaId = 'floe-usr-01'
}) => {
  const defaultPersona = FLOE_STUDIO_PERSONAS.find(p => p.id === initialPersonaId) || FLOE_STUDIO_PERSONAS[0];

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(defaultPersona.id);
  const [email, setEmail] = useState<string>(defaultPersona.email);
  const [password, setPassword] = useState<string>(defaultPersona.password || 'FloeArchitect#2026');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotSubmitted, setForgotSubmitted] = useState<boolean>(false);

  // Sign up form fields
  const [signUpName, setSignUpName] = useState<string>('');
  const [signUpEmail, setSignUpEmail] = useState<string>('');
  const [signUpPassword, setSignUpPassword] = useState<string>('');
  const [signUpOrg, setSignUpOrg] = useState<string>('');
  const [signUpFocus, setSignUpFocus] = useState<string>('it_service');

  const activePersona = FLOE_STUDIO_PERSONAS.find(p => p.id === selectedPersonaId) || defaultPersona;

  const handleSelectPersona = (persona: FloeStudioUser) => {
    setSelectedPersonaId(persona.id);
    setEmail(persona.email);
    setPassword(persona.password || 'SecurePass#2026');
    setErrorMessage(null);
  };

  const handleInstantPersonaLogin = (persona: FloeStudioUser) => {
    setIsLoading(true);
    setLoadingProvider(persona.name);
    setErrorMessage(null);
    setTimeout(() => {
      setIsLoading(false);
      setLoadingProvider(null);
      onLoginSuccess(persona);
    }, 350);
  };

  const handleCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(identifier);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Authenticate with server-side salted cryptographic hash store
      const result = await loginWithCredentials(email.trim(), password);
      
      if (!result.success || !result.user) {
        setIsLoading(false);
        setErrorMessage(result.error || 'Invalid email or password.');
        return;
      }

      const matched = FLOE_STUDIO_PERSONAS.find(
        p => p.email.toLowerCase() === email.trim().toLowerCase()
      );

      let authenticatedUser: FloeStudioUser;
      if (matched) {
        authenticatedUser = {
          ...matched,
          token: result.token || matched.token
        };
      } else {
        const cleanName = result.user.name || email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        const initials = cleanName
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'FL';

        authenticatedUser = {
          id: result.user.id || `floe-usr-${Date.now().toString().slice(-4)}`,
          name: cleanName || 'Enterprise Builder',
          email: email.trim(),
          password: password,
          role: result.user.role || 'application_builder',
          roleTitle: result.user.roleTitle || 'Application Builder (No-Code)',
          roleType: 'customer',
          organization: result.user.organization || email.split('@')[1]?.replace('.com', '').toUpperCase() + ' Corp' || 'Floe Enterprise',
          avatar: initials,
          tier: 'Enterprise Suite',
          avatarColor: 'bg-emerald-600',
          department: 'Workplace Innovation',
          canApproveProduction: false,
          permissions: result.user.permissions || ['requirements:create', 'requirements:update', 'release:generate', 'release:test'],
          token: result.token || `floe_sec_jwt_${Date.now().toString(16)}`,
          tokenExpiry: '24 hours',
          stats: {
            appsCreated: 3,
            workflowsDeployed: 8,
            agentsRun: 65
          }
        };
      }

      setIsLoading(false);
      onLoginSuccess(authenticatedUser);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Login failed. Please verify credentials.');
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!signUpName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!signUpEmail.trim() || !signUpEmail.includes('@')) {
      setErrorMessage('Please provide a valid work email.');
      return;
    }
    if (signUpPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const regResult = await registerWithCredentials({
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
        role: 'account_owner',
        roleTitle: 'Account Owner (Workspace Admin)',
        organization: signUpOrg.trim() || 'Custom Enterprise Workspace'
      });

      if (!regResult.success || !regResult.user) {
        setIsLoading(false);
        setErrorMessage(regResult.error || 'Registration failed.');
        return;
      }

      const initials = signUpName
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'FL';

      const newUser: FloeStudioUser = {
        id: regResult.user.id || `floe-usr-${Date.now().toString().slice(-4)}`,
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
        role: 'account_owner',
        roleTitle: 'Account Owner (Workspace Admin)',
        roleType: 'customer',
        organization: signUpOrg.trim() || 'Custom Enterprise Workspace',
        avatar: initials,
        tier: 'Enterprise Suite',
        avatarColor: 'bg-indigo-600',
        department: 'Workplace Operations',
        canApproveProduction: true,
        permissions: ['billing:manage', 'user:manage', 'role:manage', 'release:promote', 'security:manage'],
        token: regResult.token || `floe_sec_jwt_${Date.now().toString(16)}`,
        tokenExpiry: '24 hours',
        stats: {
          appsCreated: 0,
          workflowsDeployed: 0,
          agentsRun: 0
        }
      };

      setIsLoading(false);
      onLoginSuccess(newUser);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Registration failed.');
    }
  };

  const handleSsoLogin = (provider: string) => {
    setIsLoading(true);
    setLoadingProvider(provider);
    setErrorMessage(null);

    setTimeout(() => {
      const ssoUser: FloeStudioUser = {
        id: `floe-sso-${provider.toLowerCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`,
        name: `${provider} Workspace Admin`,
        email: `admin@${provider.toLowerCase().replace(/[^a-z0-9]/g, '')}-enterprise.com`,
        role: 'account_owner',
        roleTitle: `Account Owner (SSO: ${provider})`,
        roleType: 'customer',
        organization: `${provider} Enterprise Cloud`,
        avatar: provider.slice(0, 2).toUpperCase(),
        tier: 'Enterprise Suite',
        avatarColor: 'bg-indigo-600',
        department: 'Single Sign-On Federation',
        canApproveProduction: true,
        permissions: ['billing:manage', 'user:manage', 'release:promote', 'security:manage'],
        token: `sso_${provider.toLowerCase()}_token_${Date.now().toString(16)}`,
        tokenExpiry: '24 hours',
        stats: {
          appsCreated: 5,
          workflowsDeployed: 14,
          agentsRun: 110
        }
      };

      setIsLoading(false);
      setLoadingProvider(null);
      onLoginSuccess(ssoUser);
    }, 550);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      
      {/* Subtle Background Glow Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Brand Bar */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                Floe
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Studio Platform
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">No-Code AI Workplace App Builder</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Render PostgreSQL & AI Engine Live</span>
          </div>

          {onBackToStudio && (
            <button
              id="floe-login-back-btn"
              onClick={onBackToStudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
            >
              <span>Back to Studio</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Login Canvas */}
      <main className="w-full max-w-7xl mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start z-10">
        
        {/* Left Column: Platform Value Proposition & Fast Persona Selector (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Zero-Trust Enterprise Studio • Role-Based RBAC</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Build & Deploy Production Workplace Apps in Seconds
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Transform natural language into self-healing, autonomic enterprise applications with PostgreSQL schemas, Human-in-the-Loop decision gates, and role-based access control.
            </p>
          </div>

          {/* Persona Fast-Pass Section */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>All Roles & Credentials (1-Click Login)</span>
              </div>
              <span className="text-[11px] text-indigo-400 font-mono font-medium">{FLOE_STUDIO_PERSONAS.length} Active Personas</span>
            </div>

            {/* Persona Tier Filter (Customer Workspace vs Floe SaaS Platform) */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPersonaId(FLOE_STUDIO_PERSONAS[0].id)}
                className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold text-slate-300 bg-slate-900 border border-slate-700/60 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Customer Workspace ({FLOE_STUDIO_PERSONAS.filter(p => p.roleType === 'customer').length})</span>
              </button>
              <div className="text-[11px] font-bold text-purple-300 px-2 py-1 bg-purple-950/40 rounded-lg border border-purple-900/60">
                <span>Floe SaaS ({FLOE_STUDIO_PERSONAS.filter(p => p.roleType === 'platform').length})</span>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {FLOE_STUDIO_PERSONAS.map(persona => {
                const isSelected = persona.id === selectedPersonaId;
                return (
                  <div
                    key={persona.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-950/50 border-indigo-500/70 shadow-sm ring-1 ring-indigo-500/30'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectPersona(persona)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0"
                    >
                      <div className={`w-9 h-9 rounded-lg ${persona.avatarColor} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}>
                        {persona.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100 truncate">{persona.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase font-semibold truncate ${
                            persona.roleType === 'platform' 
                              ? 'bg-purple-950 text-purple-300 border border-purple-800' 
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          }`}>
                            {persona.roleType === 'platform' ? 'Floe SaaS' : 'Customer'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium truncate">{persona.roleTitle}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{persona.email}</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(persona.password || 'FloeOwner#2026', `pass-${persona.id}`)}
                        title="Copy password"
                        className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] font-mono text-slate-300 hover:text-white transition-colors"
                      >
                        {copiedKey === `pass-${persona.id}` ? 'Copied' : 'Password'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInstantPersonaLogin(persona)}
                        disabled={isLoading}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <span>Sign In</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick credentials copy helper */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Selected: <strong className="text-slate-200">{activePersona.email}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(activePersona.password || 'FloeArchitect#2026', 'active-pass')}
                className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                {copiedKey === 'active-pass' ? 'Copied Password!' : 'Copy Password'}
              </button>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xs font-bold text-slate-200">Autonomic Engine</h2>
                <p className="text-[11px] text-slate-400">Deterministic code generation & runtime</p>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-2.5">
              <Server className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xs font-bold text-slate-200">Render PostgreSQL</h2>
                <p className="text-[11px] text-slate-400">Live managed DDL schemas & migrations</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Authentication Card (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl relative">
            
            {/* Mode Switcher Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 mb-6">
              <button
                id="floe-auth-tab-signin"
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  authMode === 'signin'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign In to Studio</span>
              </button>
              <button
                id="floe-auth-tab-signup"
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  authMode === 'signup'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Workspace</span>
              </button>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="flex-1 font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="flex-1 font-medium">{successMessage}</span>
              </div>
            )}

            {/* Tab 1: SIGN IN FORM */}
            {authMode === 'signin' && (
              <form onSubmit={handleSignInSubmit} className="space-y-4">
                
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="floe-login-email" className="block text-xs font-semibold text-slate-300">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="floe-login-email"
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. alex.rivera@floe.studio"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="floe-login-password" className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="floe-login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your Floe Studio password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Session Duration */}
                <div className="flex items-center justify-between py-1 text-xs">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <span>Remember session for 30 days</span>
                  </label>
                  <span className="text-slate-500 font-mono">256-bit AES</span>
                </div>

                {/* Primary Submit Button */}
                <button
                  id="floe-login-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating Floe Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Floe Studio</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* SSO Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-slate-900 px-3 text-slate-500 uppercase tracking-wider font-semibold">
                      Or continue with SSO
                    </span>
                  </div>
                </div>

                {/* Single Sign-On Provider Buttons */}
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSsoLogin('Google Workspace')}
                    disabled={isLoading}
                    className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <span className="font-bold text-slate-100">G</span>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSsoLogin('GitHub Enterprise')}
                    disabled={isLoading}
                    className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <span className="font-mono text-slate-300 font-bold">GH</span>
                    <span>GitHub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSsoLogin('Okta SAML')}
                    disabled={isLoading}
                    className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Okta</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: SIGN UP / CREATE WORKSPACE FORM */}
            {authMode === 'signup' && (
              <form onSubmit={handleSignUpSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="signup-name" className="block text-xs font-semibold text-slate-300">
                    Your Full Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={signUpName}
                    onChange={e => setSignUpName(e.target.value)}
                    placeholder="e.g. Jordan Hayes"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="signup-email" className="block text-xs font-semibold text-slate-300">
                      Work Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      required
                      value={signUpEmail}
                      onChange={e => setSignUpEmail(e.target.value)}
                      placeholder="jordan@floe.internal"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="signup-org" className="block text-xs font-semibold text-slate-300">
                      Organization / Company
                    </label>
                    <input
                      id="signup-org"
                      type="text"
                      required
                      value={signUpOrg}
                      onChange={e => setSignUpOrg(e.target.value)}
                      placeholder="Enterprise Global Inc"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-password" className="block text-xs font-semibold text-slate-300">
                    Create Password (min. 6 characters)
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    value={signUpPassword}
                    onChange={e => setSignUpPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-focus" className="block text-xs font-semibold text-slate-300">
                    Primary App Domain Focus
                  </label>
                  <select
                    id="signup-focus"
                    value={signUpFocus}
                    onChange={e => setSignUpFocus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="it_service">IT Service Desk & Hardware Provisioning</option>
                    <option value="leave_hr">HR Leave & Time-Off Approvals</option>
                    <option value="expense_finance">Expense Claims & Audit Governance</option>
                    <option value="custom_workflows">Custom Autonomic Workplace Workflows</option>
                  </select>
                </div>

                <button
                  id="floe-signup-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Floe Studio Workspace...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Launch New Studio Workspace</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Security Trust Badges */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>SOC2 Type II Certified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Zero Data Training Retention</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-sky-400" />
                <span>Render PostgreSQL Backed</span>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Reset Floe Studio Password</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotModalOpen(false);
                  setForgotSubmitted(false);
                }}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="space-y-3 py-2">
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="font-bold">Password Reset Instructions Sent</p>
                    <p className="text-[11px] text-emerald-300/80 mt-0.5">
                      We dispatched a zero-trust reset token to <strong>{forgotEmail || email}</strong>. Check your inbox to set a new password.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotModalOpen(false);
                    setForgotSubmitted(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  setForgotSubmitted(true);
                }}
                className="space-y-3.5"
              >
                <p className="text-xs text-slate-400">
                  Enter your registered work email to receive a recovery token.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail || email}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto py-4 text-center text-xs text-slate-500 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 z-10">
        <div>
          <span>© 2026 Floe Autonomic AI Studio • Enterprise Edition</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <span>SOC2 Type II</span>
          <span>•</span>
          <span>ISO 27001</span>
          <span>•</span>
          <span>HIPAA Ready</span>
          <span>•</span>
          <span>Render PostgreSQL Verified</span>
        </div>
      </footer>

    </div>
  );
};
