import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Library as LibraryIcon, Trash2 } from 'lucide-react';
import LibraryToolbar from '@/components/library/LibraryToolbar';
import LibraryCard from '@/components/library/LibraryCard';
import LibraryEditor from '@/components/library/LibraryEditor';
import ViralEditorPanel from '@/components/library/ViralEditorPanel';
import ViralCanvas from '@/components/library/ViralCanvas';
import { formatShotList, newBeat, stamp } from '@/lib/libraryItems';

// The library keeps what works: hooks, scripts, looks and editing methods, saved
// by hand or lifted off a winning signal. Content Studio is handed the best of
// them every time it writes, so a pattern saved here changes the next post.
// The viral editor turns a saved hook and method into a timed cut list.

export default function Library() {
  const { business, ready } = useActiveBusiness();
  const { toast } = useToast();

  const [tab, setTab] = useState('library');
  const [items, setItems] = useState([]);
  const [pool, setPool] = useState([]);
  const [edits, setEdits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
  const [active, setActive] = useState(null);
  const [beats, setBeats] = useState([]);

  // Typing refilters on the server, so the list never grows into a client-side scan.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadItems = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    const filter = { business_id: business.id };
    if (kind !== 'all') filter.kind = kind;
    if (query) filter.$or = [{ title: { $regex: query } }, { body: { $regex: query } }, { notes: { $regex: query } }];

    const page = await base44.entities.LibraryItem
      .filter(filter, { sort: '-created_date', limit: 60 })
      .catch(() => ({ items: [] }));
    setItems(page.items || []);
    setLoading(false);
  }, [business, kind, query]);

  const loadEdits = useCallback(async () => {
    if (!business) return;
    const page = await base44.entities.ViralEdit
      .filter({ business_id: business.id }, { sort: '-created_date', limit: 12 })
      .catch(() => ({ items: [] }));
    setEdits(page.items || []);
  }, [business]);

  // The editor picks from every pattern, whatever the library tab is filtered to.
  const loadPool = useCallback(async () => {
    if (!business) return;
    const page = await base44.entities.LibraryItem
      .filter(
        { business_id: business.id, kind: { $in: ['hook', 'script', 'visual_template', 'editing_recipe'] } },
        { sort: '-score', limit: 60 }
      )
      .catch(() => ({ items: [] }));
    setPool(page.items || []);
  }, [business]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadEdits();
  }, [loadEdits]);

  const failure = (error) => error?.response?.data?.error || error.message;

  const saveItem = async (payload) => {
    setBusy('item');
    try {
      if (editor?.id) {
        const updated = await base44.entities.LibraryItem.update(editor.id, payload);
        setItems((list) => list.map((item) => (item.id === editor.id ? { ...item, ...updated } : item)));
        setPool((list) => list.map((item) => (item.id === editor.id ? { ...item, ...updated } : item)));
        toast({ title: 'Pattern updated' });
      } else {
        const created = await base44.entities.LibraryItem.create({ business_id: business.id, source: 'manual', ...payload });
        setItems((list) => [created, ...list]);
        setPool((list) => [created, ...list]);
        toast({ title: 'Saved to your library', description: 'The writer will be given it from now on.' });
      }
      setEditor(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save that pattern', description: failure(error) });
    } finally {
      setBusy('');
    }
  };

  const deleteItem = async (item) => {
    await base44.entities.LibraryItem.delete(item.id);
    setItems((list) => list.filter((entry) => entry.id !== item.id));
    setPool((list) => list.filter((entry) => entry.id !== item.id));
    toast({ title: 'Pattern deleted' });
  };

  const toggleFavorite = async (item) => {
    const favorite = !item.favorite;
    setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, favorite } : entry)));
    await base44.entities.LibraryItem.update(item.id, { favorite });
  };

  const copy = async (item) => {
    await navigator.clipboard.writeText(item.body);
    toast({ title: 'Copied', description: item.title });
  };

  const build = async (payload) => {
    setBusy('build');
    try {
      const res = await base44.functions.invoke('buildViralEdit', { business_id: business.id, ...payload });
      const edit = res.data?.edit;
      if (!edit) throw new Error(res.data?.error || 'The editor did not return a plan.');
      setActive(edit);
      setBeats(edit.beats || []);
      await loadEdits();
      toast({ title: 'Edit built', description: `${(edit.beats || []).length} beats · ${Math.round(edit.total_seconds || 0)}s.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not build that edit', description: failure(error) });
    } finally {
      setBusy('');
    }
  };

  const openEdit = (edit) => {
    setActive(edit);
    setBeats(edit.beats || []);
    setTab('editor');
  };

  const saveBeats = async () => {
    if (!active) return;
    setBusy('save');
    const total = Math.round(beats.reduce((sum, beat) => sum + (Number(beat.seconds) || 0), 0) * 10) / 10;
    try {
      await base44.entities.ViralEdit.update(active.id, { beats, total_seconds: total });
      setActive({ ...active, beats, total_seconds: total });
      setEdits((list) => list.map((edit) => (edit.id === active.id ? { ...edit, beats, total_seconds: total } : edit)));
      toast({ title: 'Edit saved', description: `${beats.length} beats · ${Math.round(total)}s.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save the edit', description: failure(error) });
    } finally {
      setBusy('');
    }
  };

  const keepSheet = async () => {
    if (!active) return;
    setBusy('sheet');
    try {
      const item = await base44.entities.LibraryItem.create({
        business_id: business.id,
        kind: 'edit_sheet',
        title: active.title,
        body: formatShotList(beats),
        platform: active.platform,
        format: active.format,
        source: 'viral_editor',
        source_label: active.recipe_label || '',
        tags: ['edit-sheet'],
        notes: active.style_notes || '',
      });
      setItems((list) => [item, ...list]);
      toast({ title: 'Edit sheet kept', description: 'It is in the library with your other patterns.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not keep that sheet', description: failure(error) });
    } finally {
      setBusy('');
    }
  };

  const deleteEdit = async (edit) => {
    await base44.entities.ViralEdit.delete(edit.id);
    setEdits((list) => list.filter((entry) => entry.id !== edit.id));
    if (active?.id === edit.id) {
      setActive(null);
      setBeats([]);
    }
  };

  if (!ready) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto text-center">
        <LibraryIcon className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="font-space font-bold text-2xl mb-2">Content Library</h1>
        <p className="text-muted-foreground mb-6">Add a business profile first — patterns are kept per business.</p>
        <Link to="/businesses/new">
          <Button>Add a business</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <LibraryIcon className="w-6 h-6 text-primary" /> Content Library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hooks, scripts, looks and editing methods that already work for {business.name}. Everything saved here is
          handed to the writer the next time content is generated.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="editor">Viral editor</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-5">
          <LibraryToolbar
            kind={kind}
            onKindChange={setKind}
            search={search}
            onSearchChange={setSearch}
            onAdd={() => setEditor({})}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Opening your library.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <LibraryIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <h2 className="font-space font-semibold">Nothing saved here yet</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Add a pattern by hand, or open Demand Radar and keep the hooks, looks and editing methods behind what is
                winning in your niche.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <LibraryCard
                  key={item.id}
                  item={item}
                  onCopy={copy}
                  onEdit={setEditor}
                  onDelete={deleteItem}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="editor" className="space-y-5">
          <ViralEditorPanel items={pool} onBuild={build} busy={busy} />

          <ViralCanvas
            edit={active}
            beats={beats}
            busy={busy}
            onBeatsChange={setBeats}
            onAddBeat={() => setBeats((list) => [...list, newBeat()])}
            onSave={saveBeats}
            onSaveToLibrary={keepSheet}
            onStartOver={() => {
              setActive(null);
              setBeats([]);
            }}
          />

          {edits.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-space font-semibold text-sm">Edits you have built</h3>
              <div className="mt-3 space-y-2">
                {edits.map((edit) => (
                  <div
                    key={edit.id}
                    className="flex items-center justify-between gap-3 bg-surface-2 border border-border rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{edit.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {edit.platform} · {(edit.beats || []).length} beats · {stamp(edit.total_seconds || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => openEdit(edit)}>
                        Open
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteEdit(edit)}
                        title="Delete this edit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LibraryEditor
        open={Boolean(editor)}
        item={editor?.id ? editor : null}
        saving={busy === 'item'}
        onOpenChange={(open) => !open && setEditor(null)}
        onSave={saveItem}
      />
    </div>
  );
}