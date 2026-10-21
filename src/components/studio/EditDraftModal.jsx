import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

export default function EditDraftModal({ draft, onSave, onClose }) {
  const [form, setForm] = useState({
    title: draft.title || '',
    hook: draft.hook || '',
    caption: draft.caption || '',
    hashtags: draft.hashtags || '',
    call_to_action: draft.call_to_action || '',
    image_prompt: draft.image_prompt || '',
    status: draft.status || 'draft',
  });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-space font-bold text-lg">Edit draft</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={form.title} onChange={set('title')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hook">Hook</Label>
            <Input id="hook" value={form.hook} onChange={set('hook')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea id="caption" rows={6} value={form.caption} onChange={set('caption')} />
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
            <Label htmlFor="image">Image prompt</Label>
            <Textarea id="image" rows={3} value={form.image_prompt} onChange={set('image_prompt')} />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving || !form.caption.trim()} className="flex-1 bg-primary font-medium">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}