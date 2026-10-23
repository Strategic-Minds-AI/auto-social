import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { KINDS, PLATFORMS } from '@/lib/libraryItems';

const EMPTY = { kind: 'hook', title: '', body: '', platform: 'any', tags: '', notes: '' };

const placeholders = {
  hook: 'The opening line, written with {brackets} where the topic changes.',
  script: 'The shape of the piece: hook, the three moves, then the ask.',
  visual_template: 'What is on screen, the palette, where the words sit.',
  editing_recipe: 'Pacing, cuts, transitions, caption style and sound.',
  edit_sheet: 'The timed shot list.',
};

export default function LibraryEditor({ open, item, onOpenChange, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      item
        ? {
            kind: item.kind,
            title: item.title || '',
            body: item.body || '',
            platform: item.platform || 'any',
            tags: (item.tags || []).join(', '),
            notes: item.notes || '',
          }
        : EMPTY
    );
  }, [open, item]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    onSave({
      kind: form.kind,
      title: form.title.trim(),
      body: form.body.trim(),
      platform: form.platform === 'any' ? '' : form.platform,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: form.notes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-space">{item ? 'Edit this pattern' : 'Add a pattern'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">What is it</Label>
              <Select value={form.kind} onValueChange={(value) => set('kind', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Platform</Label>
              <Select value={form.platform} onValueChange={(value) => set('platform', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any platform</SelectItem>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Name</Label>
            <Input
              className="mt-1"
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="e.g. Cost-of-inaction hook"
            />
          </div>

          <div>
            <Label className="text-xs">The pattern</Label>
            <Textarea
              className="mt-1 min-h-[110px] text-sm"
              value={form.body}
              onChange={(event) => set('body', event.target.value)}
              placeholder={placeholders[form.kind]}
            />
          </div>

          <div>
            <Label className="text-xs">Labels (comma separated)</Label>
            <Input
              className="mt-1"
              value={form.tags}
              onChange={(event) => set('tags', event.target.value)}
              placeholder="fast-cut, text-overlay"
            />
          </div>

          <div>
            <Label className="text-xs">Why it works</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={2}
              value={form.notes}
              onChange={(event) => set('notes', event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.title.trim() || !form.body.trim()} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save to library
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}