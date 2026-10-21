import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, Link2 } from 'lucide-react';

const WEBHOOK_URL = 'https://auto-social.base44.app/functions/twilioInbound';

const COMMANDS = [
  { command: 'YES', meaning: 'Approve and queue the next post waiting for review' },
  { command: 'HOLD', meaning: 'Leave that post for later' },
  { command: 'STOP', meaning: 'Stop all texts' },
  { command: 'START', meaning: 'Switch texts back on' },
];

export default function WebhookSetupCard() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setCopied(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="font-space text-base flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          Let Twilio reach you
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
          <li>In Twilio, open your phone number, then Messaging.</li>
          <li>Under &quot;A message comes in&quot; choose <span className="text-foreground">Webhook</span> and <span className="text-foreground">HTTP POST</span>.</li>
          <li>Paste this address and save.</li>
        </ol>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-3">
          <code className="text-xs text-primary break-all flex-1">{WEBHOOK_URL}</code>
          <Button size="sm" variant="ghost" onClick={copy} className="shrink-0 gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Serving this app from your own domain? Use that domain in place of the address above.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-medium">What you can text back</p>
          <div className="rounded-lg border border-border divide-y divide-border">
            {COMMANDS.map(({ command, meaning }) => (
              <div key={command} className="flex items-center gap-3 px-3 py-2">
                <code className="text-xs font-semibold text-primary w-14 shrink-0">{command}</code>
                <span className="text-xs text-muted-foreground">{meaning}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}