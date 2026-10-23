import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Film, Loader2, Sparkles } from 'lucide-react';

const FORMATS = ['reel', 'short_video', 'story', 'post', 'image'];
const LENGTHS = [15, 30, 60, 90];

// Pick a proven hook, the words and an editing method from the library, or write
// them here. The editor turns that into the timed canvas below.
export default function ViralEditorPanel({ items, onBuild, busy }) {
  const [hookId, setHookId] = useState('');
  const [hook, setHook] = useState('');
  const [scriptId, setScriptId] = useState('');
  const [script, setScript] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [recipe, setRecipe] = useState('');
  const [recipeLabel, setRecipeLabel] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [format, setFormat] = useState('reel');
  const [seconds, setSeconds] = useState(30);

  const hooks = items.filter((item) => item.kind === 'hook');
  const scripts = items.filter((item) => item.kind === 'script');
  const recipes = items.filter((item) => item.kind === 'editing_recipe' || item.kind === 'visual_template');

  const building = busy === 'build';

  const takeHook = (id) => {
    setHookId(id);
    const found = hooks.find((item) => item.id === id);
    if (found) setHook(found.body);
  };

  const takeScript = (id) => {
    setScriptId(id);
    const found = scripts.find((item) => item.id === id);
    if (found) setScript(found.body);
  };

  const takeRecipe = (id) => {
    setRecipeId(id);
    const found = recipes.find((item) => item.id === id);
    setRecipe(found ? found.body : '');
    setRecipeLabel(found ? found.title : '');
  };

  const build = () => onBuild({ hook, script, recipe, recipe_label: recipeLabel, platform, format, seconds });

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div>
        <h2 className="font-space font-semibold text-lg flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" /> Viral editor
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Build the cut list: what is on screen at every beat, the words burned on the frame, the transitions and the
          sound. Drawn from the hooks and methods in your library.
        </p>
      </div>

      <div>
        <Label className="text-xs">Hook — the first beat</Label>
        <Select value={hookId} onValueChange={takeHook}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={hooks.length ? 'Pick a saved hook' : 'Nothing saved yet — write one below'} />
          </SelectTrigger>
          <SelectContent>
            {hooks.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          className="mt-2 text-sm"
          rows={2}
          value={hook}
          onChange={(event) => setHook(event.target.value)}
          placeholder="Under 12 words, and it lands in the first two seconds."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Script (optional)</Label>
          <Select value={scriptId} onValueChange={takeScript}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pick a saved script" />
            </SelectTrigger>
            <SelectContent>
              {scripts.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            className="mt-2 text-sm"
            rows={4}
            value={script}
            onChange={(event) => setScript(event.target.value)}
            placeholder="The words being delivered."
          />
        </div>

        <div>
          <Label className="text-xs">Editing method (optional)</Label>
          <Select value={recipeId} onValueChange={takeRecipe}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pick a saved method" />
            </SelectTrigger>
            <SelectContent>
              {recipes.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            className="mt-2 text-sm"
            rows={4}
            value={recipe}
            onChange={(event) => setRecipe(event.target.value)}
            placeholder="Pacing, cuts and sound the editor should follow."
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Platform</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube'].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Length</Label>
          <Select value={String(seconds)} onValueChange={(value) => setSeconds(Number(value))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LENGTHS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value} seconds
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button className="gap-2" onClick={build} disabled={building || !hook.trim()}>
          {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {building ? 'Planning the cuts…' : 'Build the edit'}
        </Button>
        <Input
          className="w-full sm:w-64"
          value={recipeLabel}
          onChange={(event) => setRecipeLabel(event.target.value)}
          placeholder="Name this edit (optional)"
        />
      </div>
    </div>
  );
}