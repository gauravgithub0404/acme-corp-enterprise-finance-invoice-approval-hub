export type AiProviderType = 'ollama' | 'gemini' | 'openai' | 'anthropic' | 'custom_openai';

export interface AiModelDefinition {
  id: string;
  name: string;
  provider: AiProviderType;
  contextWindow: number; // in tokens
  description: string;
  recommendedFor: string;
  badge?: string;
  isCloud: boolean;
  defaultEndpoint?: string;
  parametersCount?: string;
  speedRating: 'Ultra-Fast' | 'Fast' | 'Balanced' | 'Deep-Reasoning';
  costPer1kTokensInUsd: number;
}

export interface AiProviderCredential {
  provider: AiProviderType;
  apiKey: string;
  baseUrl: string;
  organizationId?: string;
  enabled: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed' | 'untested';
  lastLatencyMs?: number;
}

export interface AiSystemConfig {
  activeProvider: AiProviderType;
  activeModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  stream: boolean;
  timeoutMs: number;
  fallbackProvider?: AiProviderType;
  fallbackModel?: string;
  isCustomModel?: boolean;
  customModelName?: string;
  customEndpointUrl?: string;
  credentials: Record<AiProviderType, AiProviderCredential>;
  updatedAt: string;
  updatedBy?: string;
}

export interface AiTestResult {
  success: boolean;
  provider: AiProviderType;
  model: string;
  latencyMs: number;
  ttfbMs: number;
  tokensGenerated: number;
  tokensPerSec: number;
  sampleOutput: string;
  statusMessage: string;
  timestamp: string;
  error?: string;
  endpoint: string;
}

export interface AiGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  provider?: AiProviderType;
  temperature?: number;
  maxTokens?: number;
  context?: 'requirements' | 'codegen' | 'architecture' | 'governance' | 'general';
}

export interface AiGenerationResponse {
  success: boolean;
  text: string;
  model: string;
  provider: AiProviderType;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  durationMs: number;
  error?: string;
}

/**
 * Standard AI Model Catalog supporting Ollama Cloud (gpt-oss:120b-cloud),
 * Google Gemini, OpenAI, and Anthropic Claude.
 */
export const AI_MODELS_CATALOG: AiModelDefinition[] = [
  // ============================================================================
  // OLLAMA & OLLAMA CLOUD MODELS
  // ============================================================================
  {
    id: 'gpt-oss:120b-cloud',
    name: 'Ollama GPT-OSS 120B Cloud',
    provider: 'ollama',
    contextWindow: 131072,
    parametersCount: '120 Billion',
    isCloud: true,
    defaultEndpoint: 'https://cloud.ollama.ai/v1',
    description: 'Flagship 120B parameter open-weights reasoning model hosted on Ollama Cloud. Optimized for complex enterprise system synthesis, multi-table SQL DDL, and transactional state machines.',
    recommendedFor: 'Complex AST Compilation, Architecture Synthesis & Deep Reasoning',
    badge: 'Featured Cloud Model',
    speedRating: 'Fast',
    costPer1kTokensInUsd: 0.0004
  },
  {
    id: 'llama3.3:70b',
    name: 'Ollama Llama 3.3 70B',
    provider: 'ollama',
    contextWindow: 131072,
    parametersCount: '70 Billion',
    isCloud: true,
    defaultEndpoint: 'https://cloud.ollama.ai/v1',
    description: 'High performance instruction-tuned model for structured workflow evaluation and role policies.',
    recommendedFor: 'Workflow Logic & Role Generation',
    badge: 'High Accuracy',
    speedRating: 'Fast',
    costPer1kTokensInUsd: 0.0003
  },
  {
    id: 'deepseek-r1:671b',
    name: 'Ollama DeepSeek-R1 (Cloud)',
    provider: 'ollama',
    contextWindow: 65536,
    parametersCount: '671 Billion (MoE 37B active)',
    isCloud: true,
    defaultEndpoint: 'https://cloud.ollama.ai/v1',
    description: 'Advanced Mixture-of-Experts reasoning engine with chain-of-thought verification for safety-critical logic.',
    recommendedFor: 'Hard Floor Governance & Referential Integrity',
    badge: 'Deep Reasoning',
    speedRating: 'Deep-Reasoning',
    costPer1kTokensInUsd: 0.00055
  },
  {
    id: 'qwen2.5-coder:32b',
    name: 'Ollama Qwen 2.5 Coder 32B',
    provider: 'ollama',
    contextWindow: 32768,
    parametersCount: '32 Billion',
    isCloud: false,
    defaultEndpoint: 'http://localhost:11434/v1',
    description: 'Dedicated coding model for Express REST APIs and TypeScript service boundary compilation.',
    recommendedFor: 'TypeScript / Express Code Generation',
    badge: 'Code Specialist',
    speedRating: 'Fast',
    costPer1kTokensInUsd: 0.0
  },
  {
    id: 'custom-ollama-model',
    name: 'Custom Ollama Instance / Model',
    provider: 'ollama',
    contextWindow: 65536,
    parametersCount: 'Custom',
    isCloud: false,
    defaultEndpoint: 'http://localhost:11434/v1',
    description: 'Connect to any private or on-premises Ollama node running custom fine-tuned GGUF models.',
    recommendedFor: 'Private Air-Gapped & On-Premises Nodes',
    badge: 'Self-Hosted',
    speedRating: 'Balanced',
    costPer1kTokensInUsd: 0.0
  },

  // ============================================================================
  // GOOGLE GEMINI MODELS
  // ============================================================================
  {
    id: 'gemini-2.5-flash',
    name: 'Google Gemini 2.5 Flash',
    provider: 'gemini',
    contextWindow: 1048576,
    parametersCount: 'Next-Gen Multimodal',
    isCloud: true,
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    description: 'High-speed, cost-efficient Gemini foundation model with ultra-long 1M token context window.',
    recommendedFor: 'Real-time Requirements Chat & Live Schema Parsing',
    badge: 'Ultra-Fast',
    speedRating: 'Ultra-Fast',
    costPer1kTokensInUsd: 0.000075
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Google Gemini 2.5 Pro',
    provider: 'gemini',
    contextWindow: 2097152,
    parametersCount: 'Advanced Reasoning',
    isCloud: true,
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    description: 'Most capable Gemini model for deep architectural reasoning, multi-turn analysis, and full-stack code synthesis.',
    recommendedFor: 'Enterprise Architecture & DDL Integrity',
    badge: 'Flagship Gemini',
    speedRating: 'Balanced',
    costPer1kTokensInUsd: 0.00125
  },

  // ============================================================================
  // OPENAI MODELS
  // ============================================================================
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    parametersCount: 'Omni Frontier',
    isCloud: true,
    defaultEndpoint: 'https://api.openai.com/v1',
    description: 'Flagship multimodal model with robust instruction-following and deterministic structured outputs.',
    recommendedFor: 'Structured JSON / IR Extraction',
    badge: 'Omni Frontier',
    speedRating: 'Fast',
    costPer1kTokensInUsd: 0.0025
  },
  {
    id: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    parametersCount: 'Compact Frontier',
    isCloud: true,
    defaultEndpoint: 'https://api.openai.com/v1',
    description: 'High-throughput lightweight model for fast conversational UI prompts and field validations.',
    recommendedFor: 'Interactive Dialog & Fast Validation',
    badge: 'Cost-Efficient',
    speedRating: 'Ultra-Fast',
    costPer1kTokensInUsd: 0.00015
  },

  // ============================================================================
  // ANTHROPIC CLAUDE MODELS
  // ============================================================================
  {
    id: 'claude-3-7-sonnet',
    name: 'Anthropic Claude 3.7 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    parametersCount: 'Frontier Hybrid Reasoning',
    isCloud: true,
    defaultEndpoint: 'https://api.anthropic.com/v1',
    description: 'Hybrid reasoning model with extended thinking mode and high coding proficiency.',
    recommendedFor: 'Complex Code Synthesis & Refactoring',
    badge: 'Extended Thinking',
    speedRating: 'Balanced',
    costPer1kTokensInUsd: 0.003
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Anthropic Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    parametersCount: 'Frontier Coding',
    isCloud: true,
    defaultEndpoint: 'https://api.anthropic.com/v1',
    description: 'Industry-standard coding model with exceptional TypeScript/React and Express code generation.',
    recommendedFor: 'Full-stack TypeScript Output',
    badge: 'High Precision',
    speedRating: 'Fast',
    costPer1kTokensInUsd: 0.003
  }
];

/**
 * Provider metadata for UI badges, logos, and setup guides.
 */
export const AI_PROVIDERS_METADATA: Record<
  AiProviderType,
  {
    id: AiProviderType;
    displayName: string;
    tagline: string;
    icon: string;
    badgeColor: string;
    defaultModel: string;
    defaultEndpoint: string;
    docsUrl: string;
    keyPlaceholder: string;
    keyFormatRegex?: RegExp;
    isCustomizable: boolean;
  }
> = {
  ollama: {
    id: 'ollama',
    displayName: 'Ollama & Ollama Cloud',
    tagline: 'Run GPT-OSS 120B Cloud, Llama 3.3, DeepSeek, or private local LLMs',
    icon: '🦙',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    defaultModel: 'gpt-oss:120b-cloud',
    defaultEndpoint: 'https://cloud.ollama.ai/v1',
    docsUrl: 'https://ollama.com/library',
    keyPlaceholder: 'ollama_live_sk_... (or leave empty for local localhost:11434)',
    isCustomizable: true
  },
  gemini: {
    id: 'gemini',
    displayName: 'Google Gemini',
    tagline: 'Next-gen multimodal models with 1M+ token context & high throughput',
    icon: '✨',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    defaultModel: 'gemini-2.5-flash',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    docsUrl: 'https://ai.google.dev/',
    keyPlaceholder: 'AIzaSy...',
    isCustomizable: false
  },
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    tagline: 'GPT-4o and reasoning models with structured JSON outputs',
    icon: '⚡',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
    defaultModel: 'gpt-4o',
    defaultEndpoint: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/',
    keyPlaceholder: 'sk-proj-...',
    isCustomizable: false
  },
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic Claude',
    tagline: 'Claude 3.7 Sonnet & 3.5 Sonnet with extended thinking capabilities',
    icon: '🧠',
    badgeColor: 'bg-amber-50 text-amber-900 border-amber-200',
    defaultModel: 'claude-3-7-sonnet',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    docsUrl: 'https://docs.anthropic.com/',
    keyPlaceholder: 'sk-ant-api03-...',
    isCustomizable: false
  },
  custom_openai: {
    id: 'custom_openai',
    displayName: 'Custom OpenAI-Compatible API',
    tagline: 'Connect vLLM, Groq, OpenRouter, Mistral, or private inference gateways',
    icon: '🔌',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    defaultModel: 'custom-model',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    keyPlaceholder: 'gsk_... / or custom API token',
    isCustomizable: true
  }
};

export const DEFAULT_AI_CONFIG: AiSystemConfig = {
  activeProvider: 'ollama',
  activeModel: 'gpt-oss:120b-cloud',
  temperature: 0.2,
  maxTokens: 8192,
  topP: 0.95,
  stream: true,
  timeoutMs: 45000,
  fallbackProvider: 'gemini',
  fallbackModel: 'gemini-2.5-flash',
  credentials: {
    ollama: {
      provider: 'ollama',
      apiKey: '',
      baseUrl: 'https://cloud.ollama.ai/v1',
      enabled: true,
      lastTestStatus: 'untested'
    },
    gemini: {
      provider: 'gemini',
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      enabled: true,
      lastTestStatus: 'untested'
    },
    openai: {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      enabled: false,
      lastTestStatus: 'untested'
    },
    anthropic: {
      provider: 'anthropic',
      apiKey: '',
      baseUrl: 'https://api.anthropic.com/v1',
      enabled: false,
      lastTestStatus: 'untested'
    },
    custom_openai: {
      provider: 'custom_openai',
      apiKey: '',
      baseUrl: 'http://localhost:8000/v1',
      enabled: false,
      lastTestStatus: 'untested'
    }
  },
  updatedAt: new Date().toISOString()
};
