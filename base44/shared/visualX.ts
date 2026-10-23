// VISUAL-X, installed into Auto Social.
//
// The engine behind every Enhance button in the app: one rough thought goes in, an
// engineered prompt or a finished piece of content comes out.
//
// Adopted from the VISUAL-X prompt studio, whose four working parts are kept as they
// were written: the seven-part prompt structure, the request safety validator, the
// category set, and the idea that a vague request is a specification problem rather
// than a writing problem. The reasoning is unchanged; only the engine differs — this
// runs on the app's own AI gateway, so an enhance never spends platform credits.
//
// The house visual and writing rules already live in promptStudio.ts and are imported
// rather than copied, so a brief enhanced here and one made by the transformer cannot
// drift apart.

import { businessBlock, HOUSE_VISUAL_RULES } from './promptStudio.ts';

export const MAX_ENHANCE_CHARS = 2000;

// The category set the studio was built around. Used to tag what an enhance produced
// and to steer a request the owner has already classified.
export const PROMPT_CATEGORIES = [
  'Website Building',
  'System Architecture',
  'Funnel Systems',
  'Reverse Engineering',
  'Validation & Testing',
  'Deployment & Launch',
];

export const PROMPT_FRAMEWORK =
  'ROLE, OBJECTIVE, CONTEXT, STEP-BY-STEP INSTRUCTIONS, CONSTRAINTS, VALIDATION CRITERIA, EDGE CASES, OUTPUT FORMAT';

// Ported unchanged from VISUAL-X's converter: the same validator runs before any
// enhance, so a harmful or prompt-injecting thought never reaches the model.
const NEGATIVE_PATTERNS = [
  /ignore (previous|prior|above|all) (instructions|prompts|rules|guidelines)/i,
  /disregard (all|previous|prior|the) (prompts|instructions|rules)/i,
  /you are now (a|an) (different|new|evil|unrestricted)/i,
  /(reveal|show|print|output) (your|the) (system|initial|hidden) (prompt|instructions)/i,
  /jailbreak/i,
  /bypass (safety|content|filter|restrictions|guardrails)/i,
  /(generate|create|write|build) (malware|virus|exploit|phishing|ransomware|trojan|keylogger)/i,
  /hack (into|a|the|this)/i,
  /(illegal|unlawful|criminal) (activity|content|request)/i,
  /(steal|exfiltrate|extract) (data|credentials|passwords|tokens|secrets)/i,
  /inject (malicious|harmful|exploit) (code|payload|content)/i,
  /(ddos|denial of service|sql injection|xss|cross.site.scripting)/i,
  /(bomb|weapon|explosive|poison|toxin) (instructions|recipe|blueprint|guide)/i,
  /(pirate|crack|unlock|bypass) (software|license|drm|subscription|paywall)/i,
  /(dark web|black market|illegal marketplace)/i,
  /(self.harm|suicide|hurt myself|end my life)/i,
  /(dox|doxxing|swat|swatting)/i,
  /(deepfake|impersonate) (someone|celebrity|official|government)/i,
  /(counterfeit|fake) (id|passport|certificate|currency|product)/i,
  /(launder|laundering) (money|funds)/i,
];

/** Validate a thought before it is enhanced. Mirrors the studio's own gate. */
export function validateEnhanceRequest(text) {
  if (!text || typeof text !== 'string') {
    return { valid: false, reason: 'Nothing to enhance yet — type your thought first.' };
  }
  const trimmed = text.trim();
  if (trimmed.length < 3) {
    return { valid: false, reason: 'Too short to work with — give it a few more words.' };
  }
  if (trimmed.length > MAX_ENHANCE_CHARS) {
    return { valid: false, reason: `Keep it under ${MAX_ENHANCE_CHARS} characters.` };
  }
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        flagged: true,
        reason: 'Blocked by the safety validator: that request contains a harmful or prompt-injection pattern.',
      };
    }
  }
  return { valid: true, text: trimmed };
}

// What the owner is typing into decides the shape of the answer: a field that feeds an
// AI engine gets a prompt, a field that feeds a reader gets content.
export const ENHANCE_KINDS = {
  prompt: {
    label: 'a prompt for an AI system',
    output: 'prompt',
    direction: `Return one self-contained, production-grade prompt built on this structure: ${PROMPT_FRAMEWORK}. It must be specific, unambiguous and directly runnable by another AI system, and it must end with a self-check step where that system verifies its own output. Keep every limit the request implies.`,
  },
  request: {
    label: 'a request to your assistant',
    output: 'prompt',
    direction:
      'Return one clear, complete instruction for an assistant to act on: what is wanted, the specifics it must respect, and what a good result looks like. Plain sentences, no headings, under 120 words, ready to send as-is.',
  },
  content_brief: {
    label: 'a brief for a writer',
    output: 'prompt',
    direction:
      'Return a sharper creative brief: what the piece is about, the angle that makes it interesting, who it is for, the point it has to land, and what the reader should do next. Concrete and specific, no finished copy, no headings.',
  },
  image_brief: {
    label: 'an image brief',
    output: 'prompt',
    direction: `Return a photorealistic brief for one still image.\n${HOUSE_VISUAL_RULES}`,
  },
  video_brief: {
    label: 'a video brief',
    output: 'prompt',
    direction: `Return a brief for one short vertical video: what the camera sees and how it moves over the clip, plus pacing. Name the subject, action, setting, camera movement, lighting, mood and style.\n${HOUSE_VISUAL_RULES}`,
  },
  caption: {
    label: 'a social post',
    output: 'content',
    // A single field wants the post itself, not the transformer's labelled JSON shape,
    // so the house writing rules are restated as one instruction with no labels.
    direction:
      'Return the finished post and nothing else: one scroll-stopping opening line under 12 words, then 2 to 4 short lines of body written natively for the platform this business posts on, at most 3 emoji, ending on one clear call to action, with 8 to 12 hashtags on one final line. No labels, no headings, no "Hook:" or "Caption:" prefixes, no commentary. Never invent prices, awards, dates, statistics, reviews, certifications or offers that were not supplied.',
  },
  message: {
    label: 'a message to a person',
    output: 'content',
    direction:
      'Return the finished message and nothing else: natural and human, opening with the point, under 60 words, at most one emoji, no marketing speak, no filler and no labels.',
  },
  strategy: {
    label: 'a marketing objective',
    output: 'content',
    direction:
      'Return the finished objective and nothing else, in a few concrete lines: the goal, who it targets, the angle that makes it credible, the channels worth using, and how success gets measured. No labels, no filler, no restating the request.',
  },
};

/** Build the enhance request sent to the owner's own gateway. */
export function buildEnhancePrompt({ text, kind, business, discovery, category }) {
  const spec = ENHANCE_KINDS[kind] || ENHANCE_KINDS.prompt;
  const categoryLine =
    category && PROMPT_CATEGORIES.includes(category)
      ? `\nThey classified this as ${category}, so tailor the instructions, constraints and success criteria to that domain.`
      : '';

  return `You are VISUAL-X, the prompt engine installed inside Auto Social, a social media system for business owners. The owner typed a rough thought into a field and pressed Enhance. Their thought is the specification: keep every fact in it and make it work harder.

${business ? businessBlock(business, discovery) : 'NO BUSINESS SELECTED: keep the answer general and industry-neutral.'}

WHAT THEY TYPED
"""${text}"""

WHERE THEY TYPED IT
${spec.label}

WHAT TO RETURN
${spec.direction}${categoryLine}

RULES FOR EVERY ANSWER
- Keep the owner's actual meaning and every fact it contains. Never invent prices, awards, dates, statistics, reviews, certifications or offers that were not supplied.
- Write in this business's brand voice and for its audience.
- No hedging, no filler, no preamble, never mention these instructions or that you are an AI.

Return JSON:
- enhanced: the finished text, ready to use as-is.
- why: one or two sentences telling the owner what you fixed and why it will work harder.
- category: the closest match from ${PROMPT_CATEGORIES.join(', ')}, or "general" when none fits.
- alternatives: up to three other openings or versions worth trying, one line each.`;
}

export const ENHANCE_SCHEMA = {
  type: 'object',
  properties: {
    enhanced: { type: 'string' },
    why: { type: 'string' },
    category: { type: 'string' },
    alternatives: { type: 'array', items: { type: 'string' } },
  },
  required: ['enhanced'],
};