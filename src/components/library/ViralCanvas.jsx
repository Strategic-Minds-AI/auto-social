import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Copy, Loader2, Plus, RotateCcw, Save, BookmarkPlus } from 'lucide-react';
import BeatCard from './BeatCard';
import { beatStarts, formatShotList } from '@/lib/libraryItems';

// The canvas: the whole piece laid out beat by beat, left to right. Drag a beat
// and the timecodes behind it follow.
export default function ViralCanvas({ edit, beats, onBeatsChange, onAddBeat, onSave, onSaveToLibrary, onStartOver, busy }) {
  if (!edit) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing on the canvas yet. Pick a hook above and build the edit.
        </p>
      </div>
    );
  }

  const starts = beatStarts(beats);
  const total = beats.reduce((sum, beat) => sum + (Number(beat.seconds) || 0), 0);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(beats);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onBeatsChange(next);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-space font-semibold text-base truncate">{edit.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {edit.platform} · {String(edit.format || '').replace(/_/g, ' ')} · {beats.length} beats · {Math.round(total)}s
            {edit.target_seconds ? ` of ${edit.target_seconds}s asked for` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => navigator.clipboard.writeText(formatShotList(beats))}
          >
            <Copy className="w-3 h-3" /> Copy the shot list
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onAddBeat}>
            <Plus className="w-3 h-3" /> Add a beat
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onSave} disabled={busy === 'save'}>
            {busy === 'save' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save changes
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={onSaveToLibrary} disabled={busy === 'sheet'}>
            {busy === 'sheet' ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
            Keep in library
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground" onClick={onStartOver}>
            <RotateCcw className="w-3 h-3" /> Start over
          </Button>
        </div>
      </div>

      {edit.style_notes && (
        <p className="text-xs text-muted-foreground bg-surface-2 border border-border rounded-lg p-3">{edit.style_notes}</p>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="beats" direction="horizontal">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-3 overflow-x-auto pb-2">
              {beats.map((beat, index) => (
                <BeatCard
                  key={beat.id}
                  beat={beat}
                  index={index}
                  start={starts[index]}
                  onChange={(next) => onBeatsChange(beats.map((item) => (item.id === beat.id ? next : item)))}
                  onRemove={() => onBeatsChange(beats.filter((item) => item.id !== beat.id))}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <p className="text-[11px] text-muted-foreground">
        Drag a card to reorder the cut. Longer shots push every timecode after them.
      </p>
    </div>
  );
}