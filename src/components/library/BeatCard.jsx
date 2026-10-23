import { Draggable } from '@hello-pangea/dnd';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GripVertical, Trash2 } from 'lucide-react';
import { stamp } from '@/lib/libraryItems';

// One cut on the canvas. Everything the editor follows sits in one card: how
// long it is, what is on screen, the words, the way out, and the sound.
export default function BeatCard({ beat, index, start, onChange, onRemove }) {
  const set = (patch) => onChange({ ...beat, ...patch });
  const end = start + (Number(beat.seconds) || 0);

  return (
    <Draggable draggableId={beat.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="w-72 shrink-0 bg-surface-2 border border-border rounded-xl p-3 space-y-2"
        >
          <div {...provided.dragHandleProps} className="flex items-center justify-between gap-2 cursor-grab">
            <span className="text-[11px] uppercase tracking-wide text-primary flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5" />
              Beat {index + 1} · {stamp(start)}–{stamp(end)}
            </span>
            <button
              type="button"
              onClick={onRemove}
              title="Remove this beat"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0.5"
              max="12"
              step="0.5"
              value={beat.seconds}
              onChange={(event) => set({ seconds: Number(event.target.value) })}
              className="w-20 h-8 text-xs tabular-nums"
            />
            <span className="text-xs text-muted-foreground">seconds on screen</span>
          </div>

          <Textarea
            className="text-xs min-h-[64px]"
            value={beat.shot}
            onChange={(event) => set({ shot: event.target.value })}
            placeholder="What the camera shows"
          />
          <Input
            className="h-8 text-xs"
            value={beat.on_screen_text}
            onChange={(event) => set({ on_screen_text: event.target.value })}
            placeholder="Words burned on the frame"
          />
          <Input
            className="h-8 text-xs"
            value={beat.transition}
            onChange={(event) => set({ transition: event.target.value })}
            placeholder="How it cuts into the next beat"
          />
          <Input
            className="h-8 text-xs"
            value={beat.audio}
            onChange={(event) => set({ audio: event.target.value })}
            placeholder="Sound cue"
          />
        </div>
      )}
    </Draggable>
  );
}