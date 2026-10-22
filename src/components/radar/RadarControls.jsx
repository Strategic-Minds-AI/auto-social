import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Radar } from 'lucide-react';

const REGIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'IE', label: 'Ireland' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'IN', label: 'India' },
  { value: 'AE', label: 'United Arab Emirates' },
];

export default function RadarControls({ industry, onIndustryChange, region, onRegionChange, onScan, scanning }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Industry</label>
          <Input
            value={industry}
            onChange={(event) => onIndustryChange(event.target.value)}
            placeholder="Any industry, e.g. mobile car detailing"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="text-xs text-muted-foreground">Market</label>
          <Select value={region} onValueChange={onRegionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Market" />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onScan} disabled={scanning || !industry.trim()}>
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {scanning ? 'Reading the market' : 'Scan this industry'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Reads what is genuinely winning in that market and names the pattern behind it.
      </p>
    </div>
  );
}