import moment from 'moment';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const KIND_LABEL = {
  test: 'Test',
  alert: 'Post alert',
  manual: 'From the app',
  command: 'Your reply',
  opt_in: 'Resubscribed',
  opt_out: 'Opted out',
  help: 'Help',
  unknown: 'Unknown sender',
};

export default function MessageLog({ messages, loading }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="font-space text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Text history
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No texts yet. Save your number and send a test to see the thread here.
          </p>
        ) : (
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {messages.map((message) => {
              const inbound = message.direction === 'in';
              return (
                <div
                  key={message.id}
                  className={cn(
                    'rounded-lg border p-3 space-y-1.5',
                    inbound ? 'border-border bg-surface-2' : 'border-primary/25 bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-2 text-xs">
                    {inbound ? (
                      <ArrowDownLeft className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium">{inbound ? 'Received' : 'Sent'}</span>
                    <span className="text-muted-foreground">{KIND_LABEL[message.kind] || 'Message'}</span>
                    <span className="ml-auto text-muted-foreground whitespace-nowrap">
                      {moment(message.created_date).format('MMM D, h:mm A')}
                    </span>
                  </div>

                  <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{message.counterparty || '—'}</span>
                    {message.status === 'failed' && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </div>

                  {message.error && <p className="text-xs text-destructive">{message.error}</p>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}