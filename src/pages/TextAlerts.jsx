import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import TextAlertSettings from '@/components/alerts/TextAlertSettings';
import WebhookSetupCard from '@/components/alerts/WebhookSetupCard';
import MessageLog from '@/components/alerts/MessageLog';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function TextAlerts() {
  const { business, ready } = useActiveBusiness();
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  const loadMessages = useCallback(async () => {
    if (!business?.id) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }
    setLoadingMessages(true);
    try {
      const page = await base44.entities.CommsMessage.filter(
        { business_id: business.id },
        { sort: '-created_date', limit: 50 }
      );
      setMessages(page?.items || []);
    } finally {
      setLoadingMessages(false);
    }
  }, [business?.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  if (!ready) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="font-space font-bold text-2xl mb-2">Text Alerts</h1>
        <p className="text-muted-foreground mb-6">
          Add a business profile first — text alerts run per business.
        </p>
        <Button asChild>
          <Link to="/businesses/new">Add a business</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-space font-bold text-2xl">Text Alerts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Run {business.name}&apos;s calendar from your phone — get a text when a post goes out, and reply to approve the next one.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadMessages} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="space-y-6">
          <TextAlertSettings key={business.id} business={business} />
          <WebhookSetupCard />
        </div>
        <MessageLog messages={messages} loading={loadingMessages} />
      </div>
    </div>
  );
}