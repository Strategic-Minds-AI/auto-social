import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save } from 'lucide-react';

export default function EditPostModal({ post, onSave, onClose }) {
  const [form, setForm] = useState({
    scheduled_date: post.scheduled_date || '',
    scheduled_time: post.scheduled_time || '09:00',
    caption: post.caption || '',
    variant_b_caption: post.variant_b_caption || '',
    hashtags: post.hashtags || '',
    call_to_action: post.call_to_action || '',
    status: post.status || 'planned',
  });

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-space font-bold text-lg">Edit post</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={form.scheduled_date} onChange={set('scheduled_date')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={form.scheduled_time} onChange={set('scheduled_time')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea id="caption" rows={5} value={form.caption} onChange={set('caption')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="variant">A/B version</Label>
            <Textarea id="variant" rows={3} value={form.variant_b_caption} onChange={set('variant_b_caption')} placeholder="Optional alternate caption" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Textarea id="hashtags" rows={2} value={form.hashtags} onChange={set('hashtags')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cta">Call to action</Label>
            <Input id="cta" value={form.call_to_action} onChange={set('call_to_action')} />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={() => onSave({ ...form, ab_test: Boolean(form.variant_b_caption) })} className="w-full mt-6 bg-primary gap-2 font-medium">
          <Save className="w-4 h-4" />
          Save changes
        </Button>
      </div>
    </div>
  );
}