// Lightweight pre-filters for off-topic and prompt-injection attempts.
// Returns a canned redirect string if the input should short-circuit,
// otherwise null and the request proceeds to Anthropic.

const REDIRECT = "I'm here to help with AI and automation for your business. For anything else, reach out to John at john@acceleratewith.us.";

// Prompt-injection / jailbreak patterns. Keep these focused on the most
// common low-effort attacks; sophisticated attacks are handled by the
// model's own refusals + the system prompt's explicit refusal instruction.
const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+|the\s+|your\s+|previous\s+|prior\s+|above\s+)+(?:instructions|prompts?|rules|messages)/i,
  /disregard\s+(?:all\s+|the\s+|your\s+|previous\s+|prior\s+|above\s+)+(?:instructions|prompts?|rules)/i,
  /forget\s+(?:everything|your\s+(?:instructions|training|rules))/i,
  /you\s+are\s+now\s+(?:a\s+|an\s+)?(?!the\s+accelerate)/i,
  /pretend\s+(?:to\s+be|you'?re|you\s+are)\s+(?:a\s+|an\s+)?(?!the\s+accelerate)/i,
  /act\s+as\s+(?:a\s+|an\s+)?(?!the\s+accelerate)/i,
  /\b(?:DAN|developer\s+mode|jailbreak|sudo\s+mode|god\s+mode)\b/i,
  /\bsystem\s*:\s*[\w]/i,
  /reveal\s+(?:your|the)\s+(?:system\s+)?prompt/i,
  /show\s+(?:me\s+)?(?:your|the)\s+(?:system\s+)?prompt/i,
  /what\s+(?:is|are)\s+your\s+(?:system\s+)?(?:prompt|instructions)/i,
  /print\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions)/i,
  /repeat\s+(?:your|the\s+)?(?:above|previous|prior)\s+(?:text|messages?|instructions)/i,
];

// Off-topic categories we won't engage with at all.
const OFFTOPIC_PATTERNS: RegExp[] = [
  // Politics / elections
  /\b(?:trump|biden|harris|democrat|republican|gop|election|vote\s+for|liberal|conservative|left[-\s]wing|right[-\s]wing)\b/i,
  // Religion (specific theology questions, not casual mentions)
  /\b(?:is\s+god\s+real|prove\s+god|which\s+religion|christianity\s+vs|islam\s+vs|atheis[mt])\b/i,
  // Medical advice
  /\b(?:diagnose|symptoms?\s+of|is\s+this\s+cancer|should\s+i\s+see\s+a\s+doctor|medication\s+for)\b/i,
  // Legal advice
  /\b(?:should\s+i\s+sue|is\s+this\s+legal|will\s+i\s+go\s+to\s+jail|legal\s+advice|attorney[-\s]client)\b/i,
  // Personal/relationship
  /\b(?:my\s+(?:boyfriend|girlfriend|wife|husband|ex)|breakup|dating\s+advice)\b/i,
  // Adult / harmful
  /\b(?:nsfw|explicit|sexual|porn|nude)\b/i,
];

export function preflightCheck(userMessage: string): string | null {
  const trimmed = userMessage.trim();
  if (trimmed.length === 0) return null;

  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(trimmed)) return REDIRECT;
  }

  for (const pattern of OFFTOPIC_PATTERNS) {
    if (pattern.test(trimmed)) return REDIRECT;
  }

  return null;
}

export const GUARDRAIL_REDIRECT = REDIRECT;
