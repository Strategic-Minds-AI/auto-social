import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Button } from '@/components/ui/button';
import { CATEGORIES, EXPORT_PRESETS, LAYOUTS, suggestFromFilename } from '@/lib/creativePresets';
import PromptTransformer from '@/components/intelligence/PromptTransformer';
import {
  UploadCloud, Image as ImageIcon, Film, Search, Loader2, Download, Copy,
  Grid2X2, Scissors, WandSparkles, CheckCircle2, AlertCircle, FolderOpen, Layers, Plus, X
} from 'lucide-react';

const SECTIONS = [
  { id: 'library', label: 'Media Library', icon: FolderOpen },
  { id: 'resize', label: 'Resize & Export', icon: Scissors },
  { id: 'layouts', label: 'Website Layouts', icon: Grid2X2 },
  { id: 'video', label: 'Video Storyboard', icon: Film },
  { id: 'prompt', label: 'AI Prompt Studio', icon: WandSparkles }
];

async function mediaSize(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    if (file.type.startsWith('image/')) {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = objectUrl; });
      return { width: image.naturalWidth, height: image.naturalHeight, duration_seconds: 0 };
    }
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; video.src = objectUrl; });
      const result = { width: video.videoWidth, height: video.videoHeight, duration_seconds: Number.isFinite(video.duration) ? video.duration : 0 };
      video.removeAttribute('src'); video.load();
      return result;
    }
    return {};
  } finally { URL.revokeObjectURL(objectUrl); }
}

function safeName(name) { return String(name || 'asset').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100); }
function fileDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function createImageVariant(url, width, height, fit) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('The source image could not be loaded for export (possibly cross-origin restricted).'));
    image.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this browser.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  const scale = fit === 'contain' ? Math.min(width / image.width, height / image.height) : Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale, drawHeight = image.height * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not encode image.')), 'image/png'));
  return blob;
}

export default function MediaLibrary() {
  const { business, ready } = useActiveBusiness();
  const fileRef = useRef(null);
  const layoutRef = useRef(null);
  const [section, setSection] = useState('library');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedId, setSelectedId] = useState('');
  const [presetId, setPresetId] = useState('instagram_portrait');
  const [fit, setFit] = useState('cover');
  const [exporting, setExporting] = useState(false);
  const [tagsEdit, setTagsEdit] = useState('');
  const [categoryEdit, setCategoryEdit] = useState('Unsorted');
  const [layoutDefs, setLayoutDefs] = useState(LAYOUTS);
  const [storyboard, setStoryboard] = useState([]);
  const [storyTitle, setStoryTitle] = useState('');

  const refresh = useCallback(async () => {
    if (!business?.id) { setAssets([]); return; }
    setLoading(true); setError('');
    try {
      const page = await base44.entities.MediaAsset.filter({ business_id: business.id }, { sort: '-created_date', limit: 200 });
      setAssets(page.items || []);
    } catch (err) { setError(err?.message || 'Cannot retrieve the media library.'); }
    finally { setLoading(false); }
  }, [business?.id]);
  useEffect(() => { if (ready) refresh(); }, [ready, refresh]);

  const selected = assets.find((asset) => asset.id === selectedId) || null;
  const preset = EXPORT_PRESETS.find((item) => item.id === presetId) || EXPORT_PRESETS[0];
  const visible = assets.filter((asset) => (
    (category === 'All' || asset.category === category) &&
    [asset.title, asset.file_name, asset.category, ...(asset.tags || [])].join(' ').toLowerCase().includes(search.toLowerCase())
  ));

  const selectAsset = (asset) => {
    setSelectedId(asset.id); setTagsEdit((asset.tags || []).join(', ')); setCategoryEdit(asset.category || 'Unsorted');
  };

  const uploadFiles = async (items) => {
    if (!business?.id) { setError('Choose a business before uploading media.'); return; }
    const files = Array.from(items || []);
    if (!files.length) return;
    if (files.length > 10) { setError('Upload up to 10 files per batch.'); return; }
    const invalid = files.find((f) => !(f.type.startsWith('image/') || f.type.startsWith('video/')) || f.size > 100 * 1024 * 1024);
    if (invalid) { setError('Images/videos only, up to 100 MB per file.'); return; }
    setUploading(true); setError(''); setStatus('');
    let count = 0;
    try {
      for (const file of files) {
        setStatus('Uploading ' + (count + 1) + ' of ' + files.length + ': ' + file.name);
        const [upload, dimensions] = await Promise.all([
          base44.integrations.Core.UploadFile({ file }),
          mediaSize(file).catch(() => ({}))
        ]);
        if (!upload?.file_url) throw new Error('Upload did not return an asset URL for ' + file.name);
        const suggested = suggestFromFilename(file.name);
        const saved = await base44.entities.MediaAsset.create({
          business_id: business.id,
          title: file.name.replace(/\.[^.]+$/, ''),
          file_name: file.name,
          media_type: file.type.startsWith('video/') ? 'video' : 'image',
          asset_url: upload.file_url, mime_type: file.type, size_bytes: file.size,
          ...dimensions, ...suggested, source: 'upload', approval_status: 'draft'
        });
        if (saved?.id) selectAsset(saved);
        count++;
      }
      setStatus(count + ' asset(s) uploaded. Categories are suggested from filenames; review them before using.');
      await refresh();
    } catch (err) { setError('Uploaded ' + count + ' of ' + files.length + '. ' + (err?.message || 'Upload failed.')); await refresh(); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const saveMetadata = async () => {
    if (!selected) return;
    try {
      await base44.entities.MediaAsset.update(selected.id, {
        category: categoryEdit,
        tags: tagsEdit.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20),
        classification_method: 'human', classification_confidence: 1,
        classification_note: 'Reviewed and classified manually.'
      });
      setStatus('Asset metadata saved.'); await refresh();
    } catch (err) { setError(err?.message || 'Update failed.'); }
  };

  const exportVariant = async (saveToLibrary) => {
    if (!selected || selected.media_type !== 'image') return;
    setExporting(true); setError('');
    try {
      const blob = await createImageVariant(selected.asset_url, preset.width, preset.height, fit);
      const filename = safeName(selected.title || 'asset') + '_' + preset.id + '.png';
      if (!saveToLibrary) {
        fileDownload(blob, filename);
        setStatus('Downloaded ' + filename);
      } else {
        const file = new File([blob], filename, { type: 'image/png' });
        const upload = await base44.integrations.Core.UploadFile({ file });
        if (!upload?.file_url) throw new Error('Variant upload did not return an asset URL.');
        await base44.entities.MediaAsset.create({
          business_id: business.id, title: filename, file_name: filename,
          media_type: 'image', asset_url: upload.file_url, mime_type: 'image/png',
          size_bytes: blob.size, width: preset.width, height: preset.height,
          source: 'derivative', source_asset_id: selected.id, platform_preset: preset.id,
          category: selected.category, tags: selected.tags || [], classification_method: 'human',
          classification_confidence: 1, approval_status: 'draft'
        });
        setStatus('Saved new derivative without changing the original.'); await refresh();
      }
    } catch (err) { setError(err?.message || 'Could not resize image.'); }
    finally { setExporting(false); }
  };

  const importLayouts = async (file) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const entries = Array.isArray(parsed) ? parsed : parsed.layouts;
      if (!Array.isArray(entries) || !entries.length || entries.length > 100) throw new Error('Expected a JSON array or { "layouts": [...] } (1–100).');
      const safe = entries.map((v, idx) => ({
        id: String(v.id || 'layout_' + idx).slice(0, 80),
        name: String(v.name || 'Imported layout').slice(0, 80),
        slots: (Array.isArray(v.slots) ? v.slots : []).slice(0, 20).map(s => String(s).slice(0, 120))
      }));
      setLayoutDefs(safe); setStatus('Imported ' + safe.length + ' layouts for this session. No global overwrite performed.');
      setError('');
    } catch (err) { setError(err?.message || 'Invalid layout package.'); }
  };

  const addStoryboard = (asset) => {
    setStoryboard((rows) => rows.concat({ id: String(Date.now()) + '_' + asset.id, asset_id: asset.id, title: asset.title, url: asset.asset_url, media_type: asset.media_type, duration: 5 }));
    setStatus('Shot added to storyboard. Open the Video Storyboard tab to review.');
  };
  const exportStoryboard = () => {
    const payload = { schema: 'x1_storyboard_v1', business_id: business?.id, title: storyTitle || 'Untitled video', aspect_ratio: '9:16', draft_only: true, shots: storyboard };
    fileDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), safeName(storyTitle || 'storyboard') + '.json');
  };

  if (!ready) return <div className="p-8 text-muted-foreground">Loading your marketing workspace…</div>;
  if (!business?.id) return <div className="p-8"><h1 className="text-2xl font-semibold">Creative Asset Studio</h1><p className="mt-3">Choose or create a business to organize assets privately.</p><Link className="underline text-primary" to="/businesses">Open businesses</Link></div>;

  return (
    <div className="max-w-7xl mx-auto p-5 lg:p-8 space-y-6">
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div><p className="text-xs uppercase tracking-widest text-primary mb-1">Strategic Minds AI · Marketing Department</p>
          <h1 className="text-3xl font-bold font-space">Creative Asset Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">A central workspace for {business.name}: organize, resize, develop concepts and send to review.</p></div>
        <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Import images / videos'}
        </Button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map(({ id, label, icon: Icon }) =>
          <button key={id} onClick={() => setSection(id)} type="button"
            className={'flex items-center whitespace-nowrap gap-2 rounded-xl px-3 py-2 border text-sm ' + (section === id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-card text-muted-foreground')}>
            <Icon className="w-4 h-4" />{label}</button>
        )}
      </div>

      {status && <div role="status" className="rounded-lg border border-border bg-card p-3 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" />{status}</div>}
      {error && <div role="alert" className="rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      {section === 'library' && <>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 bg-card min-w-[220px] flex-1"><Search className="w-4 h-4 text-muted-foreground" />
            <input className="bg-transparent outline-none text-sm py-2 w-full" placeholder="Search tags, file names or categories" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="border border-border rounded-lg bg-card text-sm px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            {['All', ...CATEGORIES].map(c => <option key={c}>{c}</option>)}</select>
        </div>
        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> :
          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
            <div>{visible.length === 0 ? <div className="p-12 rounded-xl border border-dashed border-border text-center text-muted-foreground">
              <UploadCloud className="w-9 h-9 mx-auto mb-3" />No assets in this view. Import company photos, brand graphics or clips.</div> :
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {visible.map(asset => <button key={asset.id} onClick={() => selectAsset(asset)}
                  className={'text-left border rounded-xl overflow-hidden bg-card ' + (selectedId === asset.id ? 'border-primary' : 'border-border')}>
                  <div className="aspect-square bg-secondary/50 flex items-center justify-center overflow-hidden">
                    {asset.media_type === 'video' ? <video src={asset.asset_url} className="w-full h-full object-cover" preload="metadata" muted /> : <img alt={asset.title || ''} src={asset.asset_url} className="w-full h-full object-cover" loading="lazy" />}</div>
                  <div className="p-2"><p className="text-xs font-medium truncate">{asset.title}</p><p className="text-[11px] text-muted-foreground truncate">{asset.category || 'Unsorted'} · {asset.media_type}</p></div>
                </button>)}
              </div>}
            </div>
            <aside className="border border-border rounded-xl bg-card p-4 space-y-3 h-fit">
              {selected ? <>
                <h3 className="font-semibold text-sm truncate">{selected.title}</h3>
                <p className="text-xs text-muted-foreground">{selected.width || '?'} × {selected.height || '?'} · {selected.media_type} · {selected.classification_method || 'unknown'}</p>
                <label className="block text-xs">Category</label>
                <select className="w-full bg-background border border-border rounded-md p-2 text-sm" value={categoryEdit} onChange={(e) => setCategoryEdit(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                <label className="block text-xs">Tags (comma separated)</label>
                <input className="w-full bg-background border border-border rounded-md p-2 text-sm" value={tagsEdit} onChange={(e) => setTagsEdit(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Filename suggestions are not visual AI recognition. Review before approval.</p>
                <Button size="sm" onClick={saveMetadata} className="w-full">Save classification</Button>
                <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => { setSection('resize'); }}>
                  <Scissors className="w-4 h-4" />Resize / export</Button>
                <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => addStoryboard(selected)}>
                  <Plus className="w-4 h-4" />Add to storyboard</Button>
                <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => { navigator.clipboard.writeText(selected.asset_url).then(() => setStatus('Asset URL copied.')).catch(() => setError('Clipboard access denied.')); }}>
                  <Copy className="w-4 h-4" />Copy asset URL</Button>
              </> : <p className="text-sm text-muted-foreground">Select an asset to see its category, metadata and actions.</p>}
            </aside>
          </div>}
      </>}

      {section === 'resize' && <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-xl border border-border bg-card p-4 min-h-64 flex items-center justify-center">
          {selected?.media_type === 'image' ? <img src={selected.asset_url} alt={selected.title || 'Selected asset'} className="max-h-[460px] object-contain" /> :
            <div className="text-center text-sm text-muted-foreground"><ImageIcon className="w-9 h-9 mx-auto mb-3" />
              Select an image from the Media Library. Video resizing requires the video render worker.</div>}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 h-fit">
          <h2 className="font-semibold">Export profile</h2>
          <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="w-full p-2 rounded-lg border border-border bg-background text-sm">
            {EXPORT_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name} ({p.width}×{p.height})</option>)}</select>
          <div className="text-sm">{preset.width} × {preset.height} px</div>
          <label className="block text-xs text-muted-foreground">Crop method</label>
          <select value={fit} onChange={(e) => setFit(e.target.value)} className="w-full p-2 rounded-lg border border-border bg-background text-sm">
            <option value="cover">Fill and crop center</option><option value="contain">Fit within frame (white background)</option></select>
          <Button className="w-full gap-2" disabled={!selected || selected.media_type !== 'image' || exporting} onClick={() => exportVariant(false)}>
            <Download className="w-4 h-4" />Download PNG</Button>
          <Button variant="outline" className="w-full" disabled={!selected || selected.media_type !== 'image' || exporting} onClick={() => exportVariant(true)}>
            {exporting ? 'Processing…' : 'Save derivative to library'}</Button>
          <p className="text-xs text-muted-foreground">Exports preserve the original. Check safe zones, quality and platform rules before posting.</p>
        </div>
      </div>}

      {section === 'layouts' && <div className="space-y-5">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <p className="text-sm text-muted-foreground">10 starter layout recipes and image slots. Import your Universal Website Layout definitions without overwriting the defaults.</p>
          <Button variant="outline" className="gap-2" onClick={() => layoutRef.current?.click()}><UploadCloud className="w-4 h-4" />Import layout JSON</Button>
          <input ref={layoutRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => importLayouts(e.target.files?.[0])} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {layoutDefs.map((layout) => <div key={layout.id} className="border border-border rounded-xl bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm"><Layers className="w-4 h-4 text-primary" />{layout.name}</div>
            <ul className="text-xs text-muted-foreground space-y-1">{layout.slots.map((s,i) => <li key={i}>• {s}</li>)}</ul>
            <Button variant="outline" size="sm" onClick={() => { setPresetId('website_hero'); setSection('resize'); }}>Prepare images</Button>
          </div>)}
        </div>
      </div>}

      {section === 'video' && <div className="grid lg:grid-cols-[1fr_350px] gap-5">
        <div className="rounded-xl bg-card border border-border p-5 space-y-4">
          <h2 className="font-semibold">Storyboard / shot list</h2>
          <p className="text-xs text-muted-foreground">Arrange a production brief from your media. This exports a JSON project for the video engine; MP4 timeline rendering is not yet connected.</p>
          <input value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} placeholder="Video title" className="w-full border border-border rounded-lg bg-background px-3 py-2 text-sm" />
          {storyboard.length === 0 ? <p className="text-sm text-muted-foreground p-8 text-center border border-dashed rounded-lg">Select media under Media Library → Add to storyboard.</p> :
            storyboard.map((shot, idx) => <div key={shot.id} className="flex gap-3 items-center border rounded-lg p-2">
              {shot.media_type === 'video' ? <Film className="w-7 h-7 text-primary" /> : <img alt="" src={shot.url} className="w-14 h-12 object-cover rounded" />}
              <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{idx + 1}. {shot.title}</p><label className="text-xs">Duration <input type="number" min="1" max="60" value={shot.duration} className="ml-2 w-16 bg-background rounded border px-1" onChange={(e) => setStoryboard(v => v.map(s => s.id === shot.id ? { ...s, duration: Math.min(60, Math.max(1, Number(e.target.value) || 1)) } : s))} /> s</label></div>
              <button title="Remove" onClick={() => setStoryboard(s => s.filter(row => row.id !== shot.id))}><X className="w-4 h-4" /></button>
            </div>)}
          <Button onClick={exportStoryboard} disabled={!storyboard.length} className="gap-2"><Download className="w-4 h-4" />Export storyboard JSON</Button>
        </div>
        <aside className="rounded-xl border border-border bg-card p-5 h-fit space-y-3">
          <h2 className="font-semibold">Existing video factory</h2>
          <p className="text-sm text-muted-foreground">AUTO SOCIAL already has its weekly video jobs, QA review and approvals. Reuse the existing queue instead of running another publisher.</p>
          <Button asChild variant="outline"><Link to="/video-studio">Open Video Studio</Link></Button>
          <Button asChild variant="outline"><Link to="/approval-queue">Open Approval Queue</Link></Button>
        </aside>
      </div>}

      {section === 'prompt' && <div className="space-y-3"><p className="text-sm text-muted-foreground">Powered by AUTO SOCIAL's existing prompt transformer and AI gateway; output includes image/video briefs and channel-specific copy.</p><PromptTransformer business={business} /></div>}
    </div>
  );
}
