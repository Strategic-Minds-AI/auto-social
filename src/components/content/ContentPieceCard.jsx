import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, ChevronUp, Image, Video, FileText, Sparkles, Loader2, Copy, Check, ExternalLink, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const PLATFORM_COLORS = {
  instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  facebook: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  tiktok: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  youtube: 'bg-red-500/10 text-red-400 border-red-500/20',
  google: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

const TYPE_ICONS = {
  post: FileText, story: Image, reel: Video, short_video: Video, google_ad: FileText
};

export default function ContentPieceCard({ piece, onDelete, onUpdate, business }) {
  const [expanded, setExpanded] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  const TypeIcon = TYPE_ICONS[piece.type] || FileText;

  const copyCaption = async () => {
    await navigator.clipboard.writeText(piece.caption + '\n\n' + piece.hashtags);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateVideo = async () => {
    setGeneratingVideo(true);
    // Clear old video first
    await base44.entities.ContentPiece.update(piece.id, { generated_video_url: null });

    const brandImageUrls = business?.brand_images?.length ? business.brand_images.slice(0, 3) : null;

    // Prompt conversion runs on the app's own AI gateway. Video rendering itself
    // stays on the existing configured integration.
    const optimized = await base44.functions.invoke('generateText', {
      task: 'video_prompt',
      business_id: business?.id,
      script: piece.video_script,
      platform: piece.platform,
    });

    const result = await base44.integrations.Core.GenerateVideo({
      prompt: optimized.data.prompt,
      aspect_ratio: piece.platform === 'youtube' ? '16:9' : '9:16',
    });
    await base44.entities.ContentPiece.update(piece.id, { generated_video_url: result.url });
    onUpdate();
    setGeneratingVideo(false);
  };

  const generateImage = async () => {
    setGeneratingImage(true);
    setImageError(false);
    // Clear old image first
    await base44.entities.ContentPiece.update(piece.id, { generated_image_url: null });

    const brandImageUrls = business?.brand_images?.length ? business.brand_images.slice(0, 3) : null;

    const result = await base44.integrations.Core.GenerateImage({
      prompt: `${piece.image_prompt}. Style: high quality, social media optimized, ${business?.tone || 'professional'} tone. Brand colors: ${business?.brand_colors || 'modern palette'}.${brandImageUrls ? ' Match the style and visual identity from the reference images.' : ''}`,
      existing_image_urls: brandImageUrls,
    });
    await base44.entities.ContentPiece.update(piece.id, { generated_image_url: result.url });
    onUpdate();
    setGeneratingImage(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
      {/* Generated image preview */}
      {piece.generated_image_url && !imageError && (
        <div className="relative group">
          <img
            src={piece.generated_image_url}
            alt="Generated"
            className="w-full h-48 object-cover"
            onError={() => setImageError(true)}
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <a href={piece.generated_image_url} target="_blank" rel="noreferrer"
              className="p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button onClick={generateImage} disabled={generatingImage}
              className="p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 transition-colors"
              title="Regenerate image">
              {generatingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TypeIcon className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{piece.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn("text-xs px-1.5 py-0.5 rounded-full border capitalize font-medium", PLATFORM_COLORS[piece.platform])}>
                  {piece.platform}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{piece.type?.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={copyCaption} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onDelete(piece.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Hook */}
        {piece.hook && (
          <div className="mb-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-lg">
            <p className="text-xs text-primary font-medium">🎯 Hook</p>
            <p className="text-xs text-foreground mt-0.5">{piece.hook}</p>
          </div>
        )}

        {/* Caption preview */}
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{piece.caption}</p>

        {/* Image section */}
        <div className="mb-3">
          {!piece.generated_image_url || imageError ? (
            <div className="border border-dashed border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                <span className="text-foreground font-medium">Image Prompt: </span>{piece.image_prompt}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={generateImage}
                disabled={generatingImage}
                className="w-full border-primary/40 text-primary hover:bg-primary/10 gap-1.5 text-xs h-8"
              >
                {generatingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingImage ? 'Generating image...' : 'Generate Image'}
              </Button>
            </div>
          ) : null}
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Show less' : 'See full content'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border space-y-3">
                {piece.caption && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Caption</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{piece.caption}</p>
                  </div>
                )}
                {piece.hashtags && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Hashtags</p>
                    <p className="text-xs text-primary">{piece.hashtags}</p>
                  </div>
                )}
                {piece.video_script && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Video Script</p>
                    <div className="bg-secondary/50 rounded-lg p-3 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                      {piece.video_script}
                    </div>
                    {/* Generated video or generate button */}
                    {piece.generated_video_url ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Generated Video</p>
                          <button onClick={generateVideo} disabled={generatingVideo}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-cyan transition-colors"
                            title="Regenerate video">
                            {generatingVideo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {generatingVideo ? 'Regenerating...' : 'Regenerate'}
                          </button>
                        </div>
                        <video
                          src={piece.generated_video_url}
                          controls
                          className="w-full rounded-lg border border-border"
                        />
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={generateVideo}
                        disabled={generatingVideo}
                        className="w-full mt-3 border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 gap-1.5 text-xs h-8"
                      >
                        {generatingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        {generatingVideo ? 'Generating video (~30–60s)...' : 'Generate Video from Script'}
                      </Button>
                    )}
                  </div>
                )}
                {piece.call_to_action && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Call to Action</p>
                    <p className="text-sm text-foreground">{piece.call_to_action}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}