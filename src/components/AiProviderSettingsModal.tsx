import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Cpu, Key, Globe, CheckCircle2, AlertCircle, RefreshCw, 
  ExternalLink, Zap, Shield, Eye, EyeOff, Sliders, PlayCircle, Check, Info, Server
} from 'lucide-react';
import { 
  AiProviderType, 
  AiSystemConfig, 
  AiTestResult, 
  AI_MODELS_CATALOG, 
  AI_PROVIDERS_METADATA, 
  DEFAULT_AI_CONFIG 
} from '../types/aiProvider';
import { FloeStudioUser } from '../types/auth';

interface AiProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: FloeStudioUser | null;
  onConfigUpdated?: (config: AiSystemConfig) => void;
}

export const AiProviderSettingsModal: React.FC<AiProviderSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onConfigUpdated
}) => {
  const [config, setConfig] = useState<AiSystemConfig>(DEFAULT_AI_CONFIG);
  const [activeTab, setActiveTab] = useState<'providers' | 'keys' | 'params' | 'diagnostics'>('providers');
  const [selectedProvider, setSelectedProvider] = useState<AiProviderType>('ollama');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-oss:120b-cloud');
  
  // Key inputs & visibility
  const [keyInputs, setKeyInputs] = useState<Record<AiProviderType, string>>({
    ollama: '',
    gemini: '',
    openai: '',
    anthropic: '',
    custom_openai: ''
  });
  const [endpointInputs, setEndpointInputs] = useState<Record<AiProviderType, string>>({
    ollama: 'https://cloud.ollama.ai/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    custom_openai: 'http://localhost:8000/v1'
  });
  const [showKeys, setShowKeys] = useState<Record<AiProviderType, boolean>>({
    ollama: false,
    gemini: false,
    openai: false,
    anthropic: false,
    custom_openai: false
  });

  // Diagnostics & testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check admin rights
  const isAdmin = currentUser?.role === 'account_owner' || 
                  currentUser?.role === 'account_admin' || 
                  currentUser?.role === 'platform_admin' || 
                  currentUser?.role === 'ciso_secops' || 
                  currentUser?.role === 'admin' ||
                  !currentUser; // allow in demo

  // Fetch current server config on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/admin/ai-config');
        if (res.ok) {
          const data: AiSystemConfig = await res.json();
          setConfig(data);
          setSelectedProvider(data.activeProvider || 'ollama');
          setSelectedModel(data.activeModel || 'gpt-oss:120b-cloud');

          const keys: Record<AiProviderType, string> = { ...keyInputs };
          const endpoints: Record<AiProviderType, string> = { ...endpointInputs };

          (Object.keys(data.credentials) as AiProviderType[]).forEach(p => {
            if (data.credentials[p]) {
              keys[p] = data.credentials[p].apiKey || '';
              endpoints[p] = data.credentials[p].baseUrl || endpoints[p];
            }
          });

          setKeyInputs(keys);
          setEndpointInputs(endpoints);
        }
      } catch {
        // use local default
      }
    };

    fetchConfig();
    setSaveSuccess(false);
    setErrorMessage(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProviderMeta = AI_PROVIDERS_METADATA[selectedProvider];
  const providerModels = AI_MODELS_CATALOG.filter(m => m.provider === selectedProvider);

  // Handle provider switch
  const handleSelectProvider = (prov: AiProviderType) => {
    setSelectedProvider(prov);
    const meta = AI_PROVIDERS_METADATA[prov];
    const defaultMod = meta.defaultModel;
    setSelectedModel(defaultMod);
    setTestResult(null);
  };

  // Run live test ping
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/ai-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          apiKey: keyInputs[selectedProvider],
          baseUrl: endpointInputs[selectedProvider]
        })
      });

      const data: AiTestResult = await res.json();
      setTestResult(data);
      if (!data.success) {
        setErrorMessage(data.statusMessage);
      }
    } catch (err: any) {
      setErrorMessage(`Diagnostic test failed: ${err.message}`);
      setTestResult({
        success: false,
        provider: selectedProvider,
        model: selectedModel,
        latencyMs: 0,
        ttfbMs: 0,
        tokensGenerated: 0,
        tokensPerSec: 0,
        sampleOutput: '',
        statusMessage: err.message,
        timestamp: new Date().toISOString(),
        error: err.message,
        endpoint: endpointInputs[selectedProvider]
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save all settings to server
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const updatedCredentials = { ...config.credentials };
      (Object.keys(keyInputs) as AiProviderType[]).forEach(p => {
        updatedCredentials[p] = {
          provider: p,
          apiKey: keyInputs[p],
          baseUrl: endpointInputs[p],
          enabled: p === selectedProvider || Boolean(keyInputs[p]),
          lastTestStatus: testResult?.provider === p ? (testResult.success ? 'success' : 'failed') : config.credentials[p]?.lastTestStatus || 'untested',
          lastTestedAt: testResult?.provider === p ? testResult.timestamp : config.credentials[p]?.lastTestedAt,
          lastLatencyMs: testResult?.provider === p ? testResult.latencyMs : config.credentials[p]?.lastLatencyMs
        };
      });

      const payload: Partial<AiSystemConfig> = {
        activeProvider: selectedProvider,
        activeModel: selectedModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        stream: config.stream,
        fallbackProvider: config.fallbackProvider,
        fallbackModel: config.fallbackModel,
        credentials: updatedCredentials
      };

      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-floe-actor-id': currentUser?.id || 'admin-user'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save AI configuration');
      }

      const result = await res.json();
      setConfig(result.config);
      setSaveSuccess(true);
      if (onConfigUpdated) {
        onConfigUpdated(result.config);
      }

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  AI Provider & Model Settings
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Admin Authority
                </span>
                {selectedModel === 'gpt-oss:120b-cloud' && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 fill-emerald-600" />
                    Ollama 120B Cloud
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Configure Ollama (gpt-oss:120b-cloud), Google Gemini, OpenAI, Claude, manage API keys, and run latency diagnostics.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('providers')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'providers'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Select Provider & Model</span>
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'keys'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>API Keys & Endpoints</span>
            {keyInputs.ollama && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('params')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'params'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Parameters & Fallback</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'diagnostics'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Connection Diagnostics</span>
            {testResult && (
              <span className={`w-2 h-2 rounded-full ${testResult.success ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Alert banners */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Configuration Error</p>
                <p className="mt-0.5 text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="font-semibold">
                AI Provider configuration updated successfully! Active Engine: <b>{selectedModel}</b> ({currentProviderMeta.displayName}).
              </p>
            </div>
          )}

          {/* TAB 1: PROVIDER & MODEL SELECTOR */}
          {activeTab === 'providers' && (
            <div className="space-y-6">
              
              {/* Provider Selection Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                  1. Choose AI Provider
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(Object.keys(AI_PROVIDERS_METADATA) as AiProviderType[]).map((provKey) => {
                    const prov = AI_PROVIDERS_METADATA[provKey];
                    const isSelected = selectedProvider === provKey;
                    const hasKey = Boolean(keyInputs[provKey]) || provKey === 'gemini';

                    return (
                      <button
                        key={provKey}
                        type="button"
                        onClick={() => handleSelectProvider(provKey)}
                        className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xl">{prov.icon}</span>
                            <span className="font-bold text-sm text-slate-900">{prov.displayName}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                            {prov.tagline}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded font-mono font-medium ${
                            hasKey ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {hasKey ? '● Configured' : '○ Key Required'}
                          </span>
                          {provKey === 'ollama' && (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <Zap className="w-3 h-3" /> 120B Cloud
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model Selection for Active Provider */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Select Intelligence Model ({currentProviderMeta.displayName})
                  </label>
                  <span className="text-xs text-slate-500 font-medium">
                    {providerModels.length} models available
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {providerModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    const isOllama120B = m.id === 'gpt-oss:120b-cloud';

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? isOllama120B 
                              ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20 shadow-xs'
                              : 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{m.name}</span>
                            {m.badge && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isOllama120B 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}>
                                {m.badge}
                              </span>
                            )}
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected 
                              ? isOllama120B ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                          {m.description}
                        </p>

                        <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                          <div>
                            <span className="block text-[10px] text-slate-400">Context</span>
                            <span className="font-semibold text-slate-700 font-mono">
                              {Math.round(m.contextWindow / 1024)}k tokens
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400">Parameters</span>
                            <span className="font-semibold text-slate-700">{m.parametersCount || 'Standard'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400">Inference</span>
                            <span className={`font-semibold ${
                              m.speedRating === 'Ultra-Fast' ? 'text-emerald-600' : 'text-slate-700'
                            }`}>
                              {m.speedRating}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Selection Summary Card */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-300">
                    Currently Targeted Engine
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg">{currentProviderMeta.icon}</span>
                    <h3 className="text-sm font-bold text-white">
                      {selectedModel}
                    </h3>
                    <span className="text-xs text-slate-300">
                      via {currentProviderMeta.displayName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Endpoint: <code className="font-mono text-slate-200">{endpointInputs[selectedProvider]}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
                  >
                    {isTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <PlayCircle className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>Ping Model</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Apply & Save</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: API KEYS & ENDPOINTS */}
          {activeTab === 'keys' && (
            <div className="space-y-6">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Enterprise Key Storage & Vault</p>
                  <p className="mt-0.5 text-indigo-700">
                    API keys are stored encrypted on the server and used strictly for backend AST generation, IR requirements parsing, and PostgreSQL compilation. Keys are never exposed to the client browser.
                  </p>
                </div>
              </div>

              {/* Form for selected provider */}
              <div className="space-y-5">
                {(Object.keys(AI_PROVIDERS_METADATA) as AiProviderType[]).map((provKey) => {
                  const meta = AI_PROVIDERS_METADATA[provKey];
                  const isCurrentActive = selectedProvider === provKey;

                  return (
                    <div
                      key={provKey}
                      className={`p-4 rounded-xl border transition-all ${
                        isCurrentActive 
                          ? 'border-indigo-300 bg-white ring-1 ring-indigo-200' 
                          : 'border-slate-200 bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{meta.icon}</span>
                          <div>
                            <span className="font-bold text-sm text-slate-900">{meta.displayName}</span>
                            {isCurrentActive && (
                              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                                ACTIVE PROVIDER
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={meta.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 font-medium"
                        >
                          <span>API Docs</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* API Key Input */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {meta.displayName} API Key / Secret Token
                          </label>
                          <div className="relative">
                            <input
                              type={showKeys[provKey] ? 'text' : 'password'}
                              value={keyInputs[provKey]}
                              onChange={(e) => setKeyInputs({ ...keyInputs, [provKey]: e.target.value })}
                              placeholder={meta.keyPlaceholder}
                              className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs text-slate-900 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKeys({ ...showKeys, [provKey]: !showKeys[provKey] })}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                              {showKeys[provKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {provKey === 'ollama' 
                              ? 'For Ollama Cloud (gpt-oss:120b-cloud), provide your Cloud token, or leave empty for local daemon.' 
                              : `Set to enable ${meta.displayName} model inference.`}
                          </p>
                        </div>

                        {/* Base URL Endpoint */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Base URL / API Endpoint
                          </label>
                          <input
                            type="text"
                            value={endpointInputs[provKey]}
                            onChange={(e) => setEndpointInputs({ ...endpointInputs, [provKey]: e.target.value })}
                            placeholder={meta.defaultEndpoint}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs text-slate-900 bg-white"
                          />
                          {provKey === 'ollama' && (
                            <div className="flex gap-2 mt-1 text-[11px]">
                              <button
                                type="button"
                                onClick={() => setEndpointInputs({ ...endpointInputs, ollama: 'https://cloud.ollama.ai/v1' })}
                                className="text-emerald-700 hover:underline font-mono"
                              >
                                [Ollama Cloud: https://cloud.ollama.ai/v1]
                              </button>
                              <button
                                type="button"
                                onClick={() => setEndpointInputs({ ...endpointInputs, ollama: 'http://localhost:11434/v1' })}
                                className="text-slate-600 hover:underline font-mono"
                              >
                                [Local: http://localhost:11434/v1]
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: HYPERPARAMETERS & FALLBACK */}
          {activeTab === 'params' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Temperature Slider */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Inference Temperature</h4>
                      <p className="text-[11px] text-slate-500">Lower = deterministic, exact code & DDL</p>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {config.temperature}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.temperature}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.0 (Deterministic Codegen)</span>
                    <span>0.5 (Balanced)</span>
                    <span>1.0 (Creative)</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Max Output Generation Tokens</h4>
                      <p className="text-[11px] text-slate-500">Maximum response length per compiler pass</p>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {config.maxTokens} tokens
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1024"
                    max="16384"
                    step="1024"
                    value={config.maxTokens}
                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value, 10) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1024 tokens</span>
                    <span>8192 (Default)</span>
                    <span>16384 (Full Monorepo)</span>
                  </div>
                </div>

                {/* Fallback Provider */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h4 className="text-xs font-bold text-slate-900">Automatic Failover Provider</h4>
                  <p className="text-[11px] text-slate-500">
                    If the primary Ollama Cloud / model endpoint returns 5xx or rate limit, automatically route to fallback.
                  </p>
                  <select
                    value={config.fallbackProvider || 'gemini'}
                    onChange={(e) => setConfig({ ...config, fallbackProvider: e.target.value as AiProviderType })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 bg-white"
                  >
                    <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
                    <option value="ollama">Ollama (gpt-oss:120b-cloud)</option>
                    <option value="openai">OpenAI (gpt-4o-mini)</option>
                    <option value="anthropic">Anthropic (claude-3-5-sonnet)</option>
                  </select>
                </div>

                {/* Response Streaming */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Live Token Streaming</h4>
                    <p className="text-[11px] text-slate-500">Stream compiler steps and requirement dialogs in real time</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.stream}
                      onChange={(e) => setConfig({ ...config, stream: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: CONNECTION DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Live Diagnostics Test ({selectedModel})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Sends an atomic validation prompt to {endpointInputs[selectedProvider]} to measure roundtrip latency, time-to-first-byte, and throughput.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  {isTesting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4" />
                  )}
                  <span>Run Live Ping</span>
                </button>
              </div>

              {testResult ? (
                <div className={`p-4 rounded-xl border space-y-3 ${
                  testResult.success ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600" />
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          {testResult.success ? 'Diagnostic Test Passed (200 OK)' : 'Diagnostic Test Failed'}
                        </h4>
                        <p className="text-[11px] text-slate-600">{testResult.statusMessage}</p>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-slate-700">
                      {testResult.latencyMs}ms
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/60 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-500">Target Model</span>
                      <span className="font-bold text-slate-800 font-mono">{testResult.model}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Latency (RTT)</span>
                      <span className="font-bold text-slate-800 font-mono">{testResult.latencyMs} ms</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Est. TTFB</span>
                      <span className="font-bold text-slate-800 font-mono">{testResult.ttfbMs} ms</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Tokens / Sec</span>
                      <span className="font-bold text-emerald-700 font-mono">{testResult.tokensPerSec} t/s</span>
                    </div>
                  </div>

                  {testResult.sampleOutput && (
                    <div className="pt-2">
                      <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Model Response Sample
                      </span>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-800">
                        {testResult.sampleOutput}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <Server className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No recent test run</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click "Run Live Ping" to test connectivity to <b>{selectedModel}</b>.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Active Engine: <b>{selectedModel}</b> ({currentProviderMeta.displayName})</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Save & Apply AI Provider</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
