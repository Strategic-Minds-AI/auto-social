import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Clock, Info } from 'lucide-react';

const COMMON_ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Australia/Sydney', 'UTC',
];

function zoneOptions() {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Array.from(new Set([browser, ...COMMON_ZONES].filter(Boolean)));
}

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ScheduleModal({ post, accounts, onClose, onSaved }) {
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [date, setDate] = useState(post.scheduled_date || todayKey());
  const [time, setTime] = useState(post.scheduled_time || '09:00');
  const [timezone, setTimezone] = useState(post.timezone || browserZone);
  const [accountId, setAccountId] = useState(post.social_account_id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isFacebook = post.platform === 'facebook';

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await base44.functions.invoke('manageScheduledPost', {
        action: post.status === 'scheduled' ? 'reschedule' : 'schedule',
        post_id: post.id,
        scheduled_date: date,
        scheduled_time: time,
        timezone,
        social_account_id: accountId || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-space flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Schedule this post
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Choose when it goes out. The time is interpreted in the timezone you pick.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sched-date">Date</Label>
              <Input id="sched-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-time">Time</Label>
              <Input id="sched-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-input" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                {zoneOptions().map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isFacebook && (
            <div className="space-y-2">
              <Label>Publish to</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="bg-input">
                  <SelectValue placeholder={accounts.length ? 'Choose a Facebook Page' : 'No Page linked yet'} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!accounts.length && (
                <p className="text-xs text-amber-400 flex gap-1.5">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" /> Link a Facebook Page in Social Accounts first, or this post will fail when it is due.
                </p>
              )}
            </div>
          )}

          {!isFacebook && (
            <p className="text-xs text-amber-400 flex gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              Publishing to {post.platform} is not connected. You can schedule it, but it will not go out until a {post.platform} account is connected.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-primary gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}