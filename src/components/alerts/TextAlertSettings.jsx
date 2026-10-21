import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useBusinessStore } from '@/lib/businessStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Send, Smartphone } from 'lucide-react';

export default function TextAlertSettings({ business }) {
  const { setActiveBusiness } = useBusinessStore();
  const { toast } = useToast();
  const [phone, setPhone] = useState(business?.notification_phone || '');
  const [alertsOn, setAlertsOn] = useState(Boolean(business?.sms_alerts));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const persist = async () => {
    const updated = await base44.entities.Business.update(business.id, {
      notification_phone: phone.trim(),
      sms_alerts: alertsOn,
    });
    setActiveBusiness(updated);
    return updated;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persist();
      toast({ title: 'Saved', description: 'Text alert settings updated for this business.' });
    } catch (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Saving first means a test uses exactly what is on screen, even if the owner
  // typed a new number and went straight for the test button.
  const handleTest = async () => {
    setTesting(true);
    try {
      await persist();
      await base44.functions.invoke('sendSms', { business_id: business.id, kind: 'test' });
      toast({ title: 'Test text sent', description: 'Check that phone for the message.' });
    } catch (error) {
      const message = error?.response?.data?.error || error.message || 'Something went wrong.';
      toast({ title: 'Test text failed', description: message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const optedOut = Boolean(business?.sms_opt_out);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="font-space text-base flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          Your text line
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="notification_phone">Mobile number</Label>
          <Input
            id="notification_phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+1 866 555 1234"
            inputMode="tel"
          />
          <p className="text-xs text-muted-foreground">
            Texts go only to this number. Nothing is ever sent to anyone else.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-2 p-4">
          <div className="space-y-1">
            <Label htmlFor="sms_alerts" className="cursor-pointer">Alert me about posts</Label>
            <p className="text-xs text-muted-foreground">
              A text when a post goes live, or when one finally fails to publish.
            </p>
          </div>
          <Switch id="sms_alerts" checked={alertsOn} onCheckedChange={setAlertsOn} />
        </div>

        {optedOut && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            This phone replied STOP, so nothing is being sent. Text START from it to switch texts back on.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
          <Button
            onClick={handleTest}
            variant="outline"
            disabled={testing || !phone.trim()}
            className="gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send a test text
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}