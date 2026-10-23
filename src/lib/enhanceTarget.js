// Where Enhance lives: whichever field the owner is typing in right now.
//
// Nothing here is React-aware except writeFieldText, which uses the native value
// setter and fires an input event, so React's own onChange runs and the field's state
// stays the single source of truth. Writing .value directly would leave state behind.

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', '']);

// Every kind the engine understands, in the owner's words. The backend holds the
// instructions; this list only drives the picker.
export const KIND_OPTIONS = [
  { value: 'prompt', label: 'A prompt for an AI system' },
  { value: 'request', label: 'A request to my assistant' },
  { value: 'content_brief', label: 'A brief for a writer' },
  { value: 'image_brief', label: 'An image brief' },
  { value: 'video_brief', label: 'A video brief' },
  { value: 'caption', label: 'A social post' },
  { value: 'message', label: 'A message to a person' },
  { value: 'strategy', label: 'A marketing objective' },
];

// The field's own words tell us what it is for. A field can always say so outright
// with data-enhance-kind, and opt out with data-no-enhance.
const KIND_HINTS = [
  [/image|photo|thumbnail|artwork|visual/i, 'image_brief'],
  [/video|reel|clip|footage|scene/i, 'video_brief'],
  [/caption|post copy|hashtag/i, 'caption'],
  [/sms|text message|reply|inbox/i, 'message'],
  [/goal|strateg|objective|audience/i, 'strategy'],
  [/ask eden|eden|assistant|question/i, 'request'],
  [/brief|topic|idea|promote|describe|what do you want/i, 'content_brief'],
];

/** The editable element a focus event landed in, or null when it is not text entry. */
export function findEditable(node) {
  if (!node || node.nodeType !== 1) return null;
  const el = node.closest ? node.closest('textarea, input, [contenteditable="true"]') : null;
  if (!el) return null;
  if (el.disabled || el.readOnly) return null;
  if (el.dataset && el.dataset.noEnhance !== undefined) return null;
  if (el.tagName === 'INPUT' && !TEXT_INPUT_TYPES.has(String(el.type || '').toLowerCase())) return null;
  return el;
}

/** Which shape of answer this field is asking for. */
export function inferEnhanceKind(el) {
  const explicit = el.dataset ? el.dataset.enhanceKind : '';
  if (explicit) return explicit;

  const label = el.closest && el.closest('div, form') ? '' : '';
  const haystack = [
    el.placeholder,
    el.getAttribute && el.getAttribute('aria-label'),
    el.name,
    el.id,
    el.dataset ? el.dataset.enhanceHint : '',
    label,
  ]
    .filter(Boolean)
    .join(' ');

  for (const [pattern, kind] of KIND_HINTS) {
    if (pattern.test(haystack)) return kind;
  }
  return 'prompt';
}

export function readFieldText(el) {
  if (!el) return '';
  if (el.isContentEditable) return el.innerText || '';
  return el.value || '';
}

/** Put text back in the field the way a keystroke would, so React sees the change. */
export function writeFieldText(el, text) {
  if (!el) return;
  if (el.isContentEditable) {
    el.innerText = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, text);
  else el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Anchor the pill to the field without covering the text or leaving the screen. */
export function pillPosition(rect) {
  const width = 104;
  const height = 28;
  const roomRight = window.innerWidth - rect.right;
  if (roomRight >= width + 12) {
    return { top: rect.top + Math.max(0, (rect.height - height) / 2), left: rect.right + 8 };
  }
  if (rect.height > 64) {
    return { top: rect.top + 8, left: Math.max(8, rect.right - width - 8) };
  }
  return {
    top: Math.max(8, rect.top - height - 6),
    left: Math.max(8, Math.min(rect.right - width - 8, window.innerWidth - width - 8)),
  };
}