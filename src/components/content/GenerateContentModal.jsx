import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'google'];
const TYPES = {
  instagram: ['post', 'story', 'reel'],
  facebook: ['post', 'story'],
  tiktok: ['short_video'],
  youtube: ['short_video'],
  google: ['google_ad'],
};
const COUNTS = [1, 3, 5, 7];

export default function GenerateContentModal({ campaign, onGenerate, onClose }) {
  const available = campaign?.platforms || PLATFORMS;
  const [platform, setPlatform] = useState(available[0] || 'instagram');
  const [type, setType] = useState(TYPES[available[0] || 'instagram'][0]);
  const [count, setCount] = useState(3);

  const handlePlatformChange = (p) => {
    setPlatform(p);
    setType(TYPES[p]?.[0] || 'post');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-space font-bold text-lg">Generate Content</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              {available.map(p => (
                <button key={p} onClick={() => handlePlatformChange(p)}
                  className={cn("px-3 py-1.5 rounded-lg border text-sm font-medium transition-all capitalize",
                    platform === p ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                  )}>
                  {p === 'youtube' ? 'YouTube' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Content Type</Label>
            <div className="flex flex-wrap gap-2">
              {(TYPES[platform] || ['post']).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={cn("px-3 py-1.5 rounded-lg border text-sm font-medium transition-all capitalize",
                    type === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                  )}>
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Number of Pieces</Label>
            <div className="flex gap-2">
              {COUNTS.map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className={cn("w-10 h-10 rounded-lg border text-sm font-bold transition-all",
                    count === n ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                  )}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={() => onGenerate({ platform, type, count })}
          className="w-full mt-6 bg-primary glow-primary-sm gap-2 font-medium"
        >
          <Sparkles className="w-4 h-4" />
          Generate {count} {type.replace('_', ' ')} for {platform}
        </Button>
      </div>
    </div>
  );
}