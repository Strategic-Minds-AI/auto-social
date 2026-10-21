import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const isFailed = (toolCall) => {
  const state = String(toolCall.status || '').toLowerCase();
  if (state === 'failed' || state === 'error') return true;
  if (typeof toolCall.results === 'string' && /error|failed/i.test(toolCall.results)) return true;
  return false;
};

const pretty = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return String(value);
  }
};

function ToolCall({ toolCall }) {
  const [open, setOpen] = useState(false);
  const failed = isFailed(toolCall);
  const running = ['pending', 'running', 'in_progress'].includes(String(toolCall.status || '').toLowerCase());
  const projection = toolCall.display_projection || {};
  const hideDetails = Boolean(projection.hide_details && projection.details_redacted);
  const label = failed
    ? projection.error_label || 'Failed'
    : running
      ? projection.active_label || 'Working'
      : projection.label || 'Done';
  const params = pretty(toolCall.arguments_string);
  const result = pretty(toolCall.results);

  return (
    <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={hideDetails}
        className="flex items-center gap-2 text-xs w-full text-left"
      >
        {running ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        ) : failed ? (
          <XCircle className="w-3.5 h-3.5 text-destructive" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        )}
        <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium">{(toolCall.name || 'step').replace(/_/g, ' ')}</span>
        <span className="text-muted-foreground truncate">{label}</span>
        {!hideDetails && (open ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />)}
      </button>
      {open && !hideDetails && (
        <div className="mt-2 space-y-2">
          {params && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Parameters</p>
              <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap break-words">{params}</pre>
            </div>
          )}
          {result && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Result</p>
              <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap break-words">{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
        )}
      >
        {message.content &&
          (isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-2 [&_p]:last:mb-0 [&_ul]:list-disc">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ))}
        {message.tool_calls?.map((toolCall, index) => (
          <ToolCall key={index} toolCall={toolCall} />
        ))}
      </div>
    </div>
  );
}