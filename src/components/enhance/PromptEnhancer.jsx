import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, Copy, Loader2, RotateCcw, Wand2, X } from 'lucide-react';
import {
  KIND_OPTIONS,
  findEditable,
  inferEnhanceKind,
  pillPosition,
  readFieldText,
  writeFieldText,
} from '@/lib/enhanceTarget';

// VISUAL-X is installed here: it watches whichever field the owner is typing in and
// turns a rough thought into an engineered prompt or finished content without leaving
// the field. The pill appears beside the field; ⌘/Ctrl + Shift + E does the same.
//
// Nothing is overwritten until the owner says so, and every apply can be undone.

const SHORTCUT_KEY = 'e';

export default function PromptEnhancer() {
  const { business } = useActiveBusiness();
  const { toast } = useToast();

  const [target, setTarget] = useState(null); // { el, kind, rect } — the live field
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('prompt');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | applied | error
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');

  const elRef = useRef(null);
  const originalRef = useRef('');
  const panelRef = useRef(null);

  const run = useCallback(
    async (kindOverride) => {
      const el = elRef.current || (target ? target.el : null);
      if (!el) return;

      const nextKind = kindOverride || target?.kind || inferEnhanceKind(el);
      const text = readFieldText(el).trim();
      if (text.length < 3) {
        toast({
          title: 'Nothing to enhance yet',
          description: 'Type your rough thought first, then press Enhance.',
        });
        return;
      }

      elRef.current = el;
      originalRef.current = readFieldText(el);
      setKind(nextKind);
      setOpen(true);
      setStatus('loading');
      setMessage('');
      setResult(null);

      try {
        const response = await base44.functions.invoke('enhanceText', {
          text,
          kind: nextKind,
          business_id: business?.id,
        });
        const data = response.data || {};
        if (data.error) throw new Error(data.error);
        setResult(data);
        setStatus('ready');
      } catch (error) {
        setMessage(error?.response?.data?.error || error.message || 'The enhance did not finish.');
        setStatus('error');
      }
    },
    [target, business?.id, toast]
  );

  // Track the field being typed in, and keep the pill anchored while the page moves.
  useEffect(() => {
    const onFocusIn = (event) => {
      const el = findEditable(event.target);
      if (!el) return;
      elRef.current = el;
      setStatus('idle');
      setResult(null);
      setMessage('');
      setTarget({ el, kind: inferEnhanceKind(el), rect: el.getBoundingClientRect() });
    };
    const onFocusOut = (event) => {
      if (panelRef.current && event.relatedTarget && panelRef.current.contains(event.relatedTarget)) return;
      setTarget(null);
    };
    const reposition = () =>
      setTarget((current) => (current ? { ...current, rect: current.el.getBoundingClientRect() } : current));

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, []);

  // The shortcut works on the field in focus, so it needs no setup anywhere.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (String(event.key).toLowerCase() !== SHORTCUT_KEY) return;
      const el = findEditable(document.activeElement);
      if (!el) return;
      event.preventDefault();
      elRef.current = el;
      setTarget({ el, kind: inferEnhanceKind(el), rect: el.getBoundingClientRect() });
      run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run]);

  const apply = (text) => {
    const el = elRef.current;
    if (!el || !document.contains(el)) {
      setMessage('That field is no longer open — copy the text instead.');
      setStatus('applied');
      return;
    }
    writeFieldText(el, text);
    setStatus('applied');
  };

  const restore = () => {
    const el = elRef.current;
    if (el && document.contains(el) && originalRef.current) {
      writeFieldText(el, originalRef.current);
      setStatus('ready');
    }
  };

  const copy = async () => {
    if (!result?.enhanced) return;
    await navigator.clipboard.writeText(result.enhanced);
    toast({ title: 'Copied', description: 'The enhanced text is on your clipboard.' });
  };

  const pill = target ? pillPosition(target.rect) : null;

  return (
    <>
      {target && pill && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run()}
          disabled={status === 'loading'}
          style={{ top: pill.top, left: pill.left }}
          aria-label="Enhance this text with VISUAL-X"
          className="fixed z-[60] flex items-center gap-1.5 rounded-full border border-primary/40 bg-card/95 px-2.5 py-1 text-[11px] font-medium text-primary shadow-lg backdrop-blur transition-colors hover:bg-primary/15"
        >
          {status === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          Enhance
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-4 right-4 z-[60] w-[380px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-auto rounded-xl border border-border bg-card p-4 shadow-2xl animate-fade-in"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              <span className="font-space text-sm font-semibold">VISUAL-X enhance</span>
            </div>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3">
            <Select
              value={kind}
              onValueChange={(value) => {
                setKind(value);
                run(value);
              }}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status === 'loading' && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Engineering your thought…
            </div>
          )}

          {status === 'error' && <p className="py-4 text-sm text-destructive">{message}</p>}

          {result && status !== 'loading' && (
            <div className="mt-3 space-y-3">
              <div className="max-h-56 overflow-auto rounded-lg bg-surface p-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.enhanced}</p>
              </div>

              {result.why && <p className="text-xs text-muted-foreground">{result.why}</p>}

              {result.alternatives?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Other versions</p>
                  {result.alternatives.map((alternative) => (
                    <button
                      key={alternative}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setResult({ ...result, enhanced: alternative })}
                      className="block w-full rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {alternative}
                    </button>
                  ))}
                </div>
              )}

              {message && <p className="text-xs text-destructive">{message}</p>}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {status === 'applied' ? (
                  <>
                    <span className="flex items-center gap-1.5 text-xs text-primary">
                      <Check className="w-3.5 h-3.5" /> Put into the field
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={restore}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Undo
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5 glow-primary-sm"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => apply(result.enhanced)}
                  >
                    <Check className="w-3.5 h-3.5" /> Use this
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={copy}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => run(kind)}
                >
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}