import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Trophy, Globe } from 'lucide-react';
import SeoPanel from '@/components/discovery/SeoPanel';
import BenchmarkPanel from '@/components/discovery/BenchmarkPanel';

// Reads the business's own website and the content winning in its category, then
// shows the two things that come out of it: how it gets found, and what the winners
// do that its own generation should copy.

export default function Discovery() {
  const { business, ready } = useActiveBusiness();
  const { toast } = useToast();

  const [website, setWebsite] = useState('');
  const [profile, setProfile] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async (businessId) => {
    const [profilePage, rulePage] = await Promise.all([
      base44.entities.SeoProfile.filter({ business_id: businessId }, { limit: 1 }),
      base44.entities.BenchmarkRule.filter({ business_id: businessId, active: true }, { sort: '-priority', limit: 8 }),
    ]);
    setProfile((profilePage.items || [])[0] || null);
    setRules(rulePage.items || []);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!business) {
      setLoading(false);
      return;
    }
    setWebsite(business.website || '');
    load(business.id)
      .catch(() => {
        setProfile(null);
        setRules([]);
      })
      .finally(() => setLoading(false));
  }, [ready, business?.id, business?.website, load]);

  const handleScan = async () => {
    if (!business) return;
    setScanning(true);
    try {
      const trimmed = website.trim();
      if (trimmed && trimmed !== (business.website || '')) {
        await base44.entities.Business.update(business.id, { website: trimmed });
      }
      const response = await base44.functions.invoke('runDiscovery', { business_id: business.id });
      const data = response.data || {};
      if (data.error) throw new Error(data.error);
      setProfile(data.profile || null);
      setRules(data.rules || []);
      toast({
        title: 'Discovery scan finished',
        description: `${data.counts?.keywords || 0} keywords, ${data.counts?.hashtags || 0} tags from ${data.counts?.signalsUsed || 0} measured pieces.`,
      });
    } catch (error) {
      toast({
        title: 'The scan did not finish',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-space font-semibold">Add a business first</h2>
          <p className="text-sm text-muted-foreground mt-1">The scan reads a business's website and category.</p>
          <Button asChild className="mt-4">
            <Link to="/businesses/new">Add a business</Link>
          </Button>
        </div>
      </div>
    );
  }

  const platform = (business.primary_platforms || [])[0] || '';

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          SEO &amp; Discovery
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reads your website and the content already winning in your category, then turns both into your keyword and
          tag plan plus a benchmark playbook that feeds your content generation.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="website">Your website</Label>
          <Input
            id="website"
            value={website}
            placeholder="https://yourbusiness.com"
            onChange={(event) => setWebsite(event.target.value)}
            data-enhance-kind="content_brief"
          />
          <p className="text-xs text-muted-foreground">
            Saved to {business.name} and read on every scan.
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning} className="gap-2 glow-primary-sm">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {scanning ? 'Reading your site and category…' : profile ? 'Run the scan again' : 'Run the discovery scan'}
        </Button>
      </div>

      {!profile && !rules.length && !scanning ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-space font-semibold">Nothing on file yet</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Add your website above and run the scan. It reads your site, then reads the measured winners already on
            file from the Demand Radar, and writes your keyword, hashtag and benchmark plan.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <div className="space-y-3">
            <h2 className="font-space font-semibold">Getting found</h2>
            <SeoPanel profile={profile} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <h2 className="font-space font-semibold">What the winners do</h2>
              <span className="text-xs text-muted-foreground">
                {rules.length ? `· these patterns are handed to Content Studio${platform ? ` for ${platform}` : ''}` : ''}
              </span>
            </div>
            {rules.length ? (
              <BenchmarkPanel rules={rules} />
            ) : (
              <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
                No patterns on file yet. Run a Demand Radar scan for your industry first, then run this scan again and
                the winners get distilled here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}