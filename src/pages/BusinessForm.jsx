import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Sparkles, Loader2, Globe, Instagram, Facebook, Youtube, Upload, X, ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBusinessStore } from '@/lib/businessStore';

const TONES = ['professional', 'casual', 'playful', 'luxury', 'inspirational', 'educational'];

export default function BusinessForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { setActiveBusiness } = useBusinessStore();

  const [form, setForm] = useState({
    name: '', description: '', website: '', industry: '',
    target_audience: '', tone: 'professional', brand_colors: '',
    social_links: { instagram: '', facebook: '', tiktok: '', youtube: '', google_business: '' }
  });
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (isEdit) {
      base44.entities.Business.filter({ id }).then(res => {
        if (res[0]) {
          setForm(res[0]);
          setAnalysis(res[0].analysis || '');
        }
      });
    }
  }, [id]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleBrandImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingImage(true);
    const uploads = await Promise.all(files.map(file => base44.integrations.Core.UploadFile({ file })));
    const newUrls = uploads.map(u => u.file_url);
    set('brand_images', [...(form.brand_images || []), ...newUrls]);
    setUploadingImage(false);
  };

  const removeBrandImage = (url) => {
    set('brand_images', (form.brand_images || []).filter(u => u !== url));
  };
  const setSocial = (platform, val) => setForm(f => ({ ...f, social_links: { ...f.social_links, [platform]: val } }));

  const handleAnalyse = async () => {
    setAnalysing(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a senior social media marketing strategist. Analyse this business and provide a detailed marketing profile.

Business Name: ${form.name}
Description: ${form.description}
Website: ${form.website}
Industry: ${form.industry}
Target Audience: ${form.target_audience}
Brand Tone: ${form.tone}
Social Presence: Instagram: ${form.social_links?.instagram || 'none'}, Facebook: ${form.social_links?.facebook || 'none'}, TikTok: ${form.social_links?.tiktok || 'none'}

Provide:
1. Business positioning summary
2. Target audience insights
3. Key value propositions for social media
4. Recommended content pillars (5 topics this brand should consistently post about)
5. Competitive advantages to highlight
6. Brand voice guidelines

Be specific, insightful and actionable. Format with clear sections.`,
      add_context_from_internet: !!form.website,
    });
    setAnalysis(result);
    setAnalysing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, analysis };
    let saved;
    if (isEdit) {
      saved = await base44.entities.Business.update(id, data);
    } else {
      saved = await base44.entities.Business.create(data);
    }
    setActiveBusiness(saved);
    setSaving(false);
    navigate('/campaigns');
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <button onClick={() => navigate('/businesses')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Businesses
      </button>

      <h1 className="font-space text-3xl font-bold mb-1">{isEdit ? 'Edit Business' : 'Add New Business'}</h1>
      <p className="text-muted-foreground mb-8">Fill in your business details and let AI analyse your marketing profile.</p>

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-space font-semibold text-lg">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Business Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Luxe Coffee Co." className="bg-input" />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="e.g. Food & Beverage" className="bg-input" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Business Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what your business does, your products/services, and what makes you unique..." className="bg-input h-28 resize-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Input value={form.target_audience} onChange={e => set('target_audience', e.target.value)} placeholder="e.g. Women 25-45, health-conscious" className="bg-input" />
            </div>
            <div className="space-y-2">
              <Label>Brand Tone</Label>
              <Select value={form.tone} onValueChange={v => set('tone', v)}>
                <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Brand Colors</Label>
            <Input value={form.brand_colors} onChange={e => set('brand_colors', e.target.value)} placeholder="e.g. Deep navy #1a2b4c, gold #d4af37" className="bg-input" />
          </div>

          {/* Brand Images */}
          <div className="space-y-2">
            <Label>Brand Reference Images</Label>
            <p className="text-xs text-muted-foreground">Upload product photos, lifestyle shots, or brand visuals. These will be used as style references for AI image and video generation.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {(form.brand_images || []).map((url, i) => (
                <div key={i} className="relative group w-20 h-20">
                  <img src={url} alt="brand" className="w-20 h-20 object-cover rounded-lg border border-border" />
                  <button onClick={() => removeBrandImage(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full items-center justify-center hidden group-hover:flex">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              <label className={`w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground mt-1">{uploadingImage ? '...' : 'Upload'}</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleBrandImageUpload} />
              </label>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-space font-semibold text-lg">Online Presence</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://yourbusiness.com" className="bg-input" />
            </div>
            <div className="flex items-center gap-3">
              <Instagram className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input value={form.social_links?.instagram || ''} onChange={e => setSocial('instagram', e.target.value)} placeholder="https://instagram.com/yourbrand" className="bg-input" />
            </div>
            <div className="flex items-center gap-3">
              <Facebook className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input value={form.social_links?.facebook || ''} onChange={e => setSocial('facebook', e.target.value)} placeholder="https://facebook.com/yourbrand" className="bg-input" />
            </div>
            <div className="flex items-center gap-3">
              <Youtube className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input value={form.social_links?.youtube || ''} onChange={e => setSocial('youtube', e.target.value)} placeholder="https://youtube.com/@yourbrand" className="bg-input" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 text-muted-foreground flex-shrink-0 text-xs font-bold">TT</span>
              <Input value={form.social_links?.tiktok || ''} onChange={e => setSocial('tiktok', e.target.value)} placeholder="https://tiktok.com/@yourbrand" className="bg-input" />
            </div>
          </div>
        </div>

        {/* Analysis */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-space font-semibold text-lg">AI Business Analysis</h2>
            <Button
              onClick={handleAnalyse}
              disabled={!form.name || !form.description || analysing}
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10 gap-2"
            >
              {analysing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analysing ? 'Analysing...' : 'Analyse Business'}
            </Button>
          </div>
          {analysis ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-secondary/50 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {analysis}
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">Click "Analyse Business" to get AI-powered marketing insights for your brand.</p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate('/businesses')}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || saving} className="bg-primary glow-purple-sm gap-2 min-w-32">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Business'}
          </Button>
        </div>
      </div>
    </div>
  );
}