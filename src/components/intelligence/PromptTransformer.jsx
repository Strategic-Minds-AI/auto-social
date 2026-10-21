import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2, Image as ImageIcon, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x'];

const EXAMPLES = [
  'We just finished a full marble restoration in a 1920s townhouse.',
  'Our roastery gets new single-origin beans every Tuesday.',
  'Why most people replace their water heater too early.',
];

export default function PromptTransformer({ business }) {
  const [sentence, setSentence] = useState('');
  const [platforms, setPlatforms] = useState(['instagram', 'facebook', 'linkedin']);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [image, setImage] = useState('');
  const [rendering, setRendering] = useState(false);
  const [saved, setSaved] = useState(false);

  const togglePlatform = (platform) =>
    setPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));

  const transform = async () => {
    setRunning(true);
    setError('');
    setImage('');
    setSaved(false);
    try {
      const res = await base44.functions.invoke('transformPrompt', {
        business_id: business.id,
        sentence,
        platforms,
      });
      if (res.data?.error) setError(res.data.error);
      else setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setRunning(false);
    }
  };

  const renderImage = async () => {
    setRendering(true);
    setError('');
    try {
      const res = await base44.integrations.Core.GenerateImage({ prompt: result.image_prompt });
      setImage(res?.url || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setRendering(false);
    }
  };

  const saveDraft = async () => {
    const res = await base44.functions.invoke('transformPrompt', {
      business_id: business.id,
      sentence,
      platforms,
      platform: platforms[0],
      save: true,
    });
    if (res.data?.saved_draft_id) setSaved(true);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="font-space font-semibold">Turn a sentence into everything</h2>
          <p className="text-sm text-muted-foreground">
            Write one plain sentence. You get an image brief, a video brief, a finished post and a rewrite for each
            platform you pick.
          </p>
        </div>

        <Textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder={EXAMPLES[0]}
          className="bg-input h-24 resize-none"
        />

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setSentence(example)}
              className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Rewrite for:</span>
          {PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => togglePlatform(platform)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors',
                platforms.includes(platform)
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {platform}
            </button>
          ))}
        </div>

        <Button onClick={transform} disabled={running || sentence.trim().length < 8} className="gap-2 glow-primary-sm">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {running ? 'Transforming...' : 'Transform'}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {result && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">Image brief</h3>
            <p className="text-sm leading-relaxed">{result.image_prompt}</p>
            <Button onClick={renderImage} disabled={rendering} variant="outline" size="sm" className="gap-2">
              {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              {rendering ? 'Rendering...' : 'Render this image'}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Rendering uses the platform image engine, which spends integration credits. The briefs above are free.
            </p>
            {image && (
              <img src={image} alt="Generated from the image brief" className="rounded-lg border border-border w-full" />
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">Video brief</h3>
            <p className="text-sm leading-relaxed">{result.video_prompt || 'No video brief was returned.'}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">Finished post</h3>
              <Button onClick={saveDraft} disabled={saved} variant="outline" size="sm" className="gap-2">
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved to Studio' : 'Save to Studio'}
              </Button>
            </div>
            {result.content?.hook && <p className="font-medium text-sm">{result.content.hook}</p>}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.content?.caption}</p>
            {result.content?.call_to_action && (
              <p className="text-sm text-primary">{result.content.call_to_action}</p>
            )}
            {result.content?.hashtags && (
              <p className="text-xs text-muted-foreground">{result.content.hashtags}</p>
            )}
          </div>

          {result.social_angles?.map((angle) => (
            <div key={angle.platform} className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground capitalize">{angle.platform}</h3>
              {angle.hook && <p className="font-medium text-sm">{angle.hook}</p>}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{angle.caption}</p>
              {angle.call_to_action && <p className="text-sm text-primary">{angle.call_to_action}</p>}
              {angle.hashtags && <p className="text-xs text-muted-foreground">{angle.hashtags}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}