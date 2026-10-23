import { ExternalLink } from 'lucide-react';

// The two images every profile needs: the square mark and the wide cover.
export default function AssetPair({ avatar_url, banner_url, title = 'Your visuals' }) {
  if (!avatar_url && !banner_url) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="font-space text-sm font-semibold">{title}</h3>

      {avatar_url && (
        <div className="flex items-center gap-3">
          <img
            src={avatar_url}
            alt="Profile picture"
            className="w-16 h-16 rounded-full border border-border object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm">Profile picture</p>
            <p className="text-xs text-muted-foreground">Square, and it still reads at 40px.</p>
          </div>
          <a
            href={avatar_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary flex items-center gap-1 hover:underline shrink-0"
          >
            Open <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {banner_url && (
        <div>
          <img src={banner_url} alt="Banner" className="w-full rounded-lg border border-border object-cover" />
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-xs text-muted-foreground">Wide cover — banner, Page cover or channel art.</p>
            <a
              href={banner_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline shrink-0"
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}