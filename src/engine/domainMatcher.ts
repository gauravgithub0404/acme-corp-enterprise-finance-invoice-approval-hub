import { DOMAINS } from '../data/domains';
import { DomainDefinition } from '../types/floe';

// ============================================================================
// NL DOMAIN INTENT MATCHER
// ----------------------------------------------------------------------------
// Takes a user's free-text description of the application/module they want
// and scores it against the keyword/description signals of every known
// DomainDefinition template. This is deliberately a deterministic, explainable
// heuristic (no opaque LLM call) so the "why did/didn't this match" reasoning
// is always inspectable and testable — matching the same philosophy as the
// reviewer model in the governance engine.
// ============================================================================

export type MatchConfidence = 'strong' | 'possible' | 'none';

export interface DomainMatch {
  domain: DomainDefinition;
  score: number;
  matchedTerms: string[];
}

export interface DomainMatchResult {
  confidence: MatchConfidence;
  /** Best-scoring matches, highest first. Empty when confidence === 'none'. */
  matches: DomainMatch[];
  /**
   * True when the top match is confident enough to proceed directly;
   * false when the request is ambiguous (multiple close matches, or a weak
   * single match) and clarifying questions should be asked before committing.
   */
  requiresClarification: boolean;
  /** Human-readable clarifying questions to show the user, when applicable. */
  clarifyingQuestions: string[];
  /** Set when confidence === 'none' — the caller should show a rejection UI. */
  rejectionMessage?: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'want', 'to', 'need', 'build', 'create', 'app', 'application',
  'for', 'my', 'our', 'me', 'us', 'and', 'or', 'with', 'that', 'can', 'system',
  'develop', 'module', 'please', 'is', 'of', 'in', 'on', 'this'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Score a single domain against the tokenized free-text request.
 * - Exact multi-word keyword phrase match (e.g. "leave management") scores
 *   highest, since it captures user intent unambiguously.
 * - Single-token overlap with keywords/display_name/description scores lower.
 */
function scoreDomain(domain: DomainDefinition, rawText: string, tokens: string[]): DomainMatch {
  const lowerText = rawText.toLowerCase();
  const matchedTerms: string[] = [];
  let score = 0;

  const keywordSource = domain.keywords && domain.keywords.length > 0
    ? domain.keywords
    : [domain.display_name, domain.description];

  for (const phrase of keywordSource) {
    const lowerPhrase = phrase.toLowerCase();
    if (lowerPhrase.split(/\s+/).length > 1 && lowerText.includes(lowerPhrase)) {
      score += 5; // full phrase match — strongest signal
      matchedTerms.push(phrase);
      continue;
    }
    const phraseTokens = tokenize(phrase);
    for (const pt of phraseTokens) {
      if (tokens.includes(pt)) {
        score += 1;
        if (!matchedTerms.includes(pt)) matchedTerms.push(pt);
      }
    }
  }

  // Small bonus for matching the domain's own display name tokens, even if
  // not listed explicitly in keywords.
  const nameTokens = tokenize(domain.display_name);
  for (const nt of nameTokens) {
    if (tokens.includes(nt) && !matchedTerms.includes(nt)) {
      score += 2;
      matchedTerms.push(nt);
    }
  }

  return { domain, score, matchedTerms };
}

/**
 * Match a free-text natural-language request against the known domain
 * templates. Returns a confident single match, a set of ambiguous
 * candidates needing clarification, or an explicit "no template matches"
 * rejection — the system never silently guesses on an unmatched request.
 */
export function matchDomainFromText(text: string): DomainMatchResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      confidence: 'none',
      matches: [],
      requiresClarification: false,
      clarifyingQuestions: [],
      rejectionMessage: 'Please describe what application or module you want to build.'
    };
  }

  const tokens = tokenize(trimmed);
  const scored = DOMAINS
    .map(d => scoreDomain(d, trimmed, tokens))
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      confidence: 'none',
      matches: [],
      requiresClarification: false,
      clarifyingQuestions: [],
      rejectionMessage:
        "I can't create this. Your request doesn't match any of our existing application templates " +
        `(${DOMAINS.map(d => d.display_name).join(', ')}). ` +
        'Try describing your need using terms closer to one of these domains, or contact your Floe administrator ' +
        'to request a new template.'
    };
  }

  const top = scored[0];
  const second = scored[1];

  // Strong, unambiguous match: clearly higher score than the runner-up, and
  // above an absolute floor so a single weak coincidental token match doesn't
  // count as confident.
  const isStrong = top.score >= 5 && (!second || top.score >= second.score * 1.6);

  if (isStrong) {
    return {
      confidence: 'strong',
      matches: scored.slice(0, 3),
      requiresClarification: false,
      clarifyingQuestions: []
    };
  }

  // Ambiguous or weak — ask clarifying questions instead of guessing.
  const candidateNames = scored.slice(0, 3).map(m => m.domain.display_name);
  const clarifyingQuestions = [
    `Did you mean one of these: ${candidateNames.join(', ')}?`,
    'Which department or team is this application primarily for?',
    'What is the main record or item your users would be creating or tracking (e.g. a ticket, a request, a deal, an invoice)?'
  ];

  return {
    confidence: 'possible',
    matches: scored.slice(0, 3),
    requiresClarification: true,
    clarifyingQuestions
  };
}
