import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useBusinessStore } from '@/lib/businessStore';

// Shared active-business resolution so every operational page behaves the same:
// use the stored selection, otherwise fall back to the first business the caller can read.
export function useActiveBusiness() {
  const { activeBusiness, setActiveBusiness } = useBusinessStore();
  const [business, setBusiness] = useState(activeBusiness || null);
  const [ready, setReady] = useState(Boolean(activeBusiness));

  useEffect(() => {
    if (activeBusiness) {
      setBusiness(activeBusiness);
      setReady(true);
      return;
    }
    let cancelled = false;
    base44.entities.Business
      .list({ sort: '-created_date', limit: 1 })
      .then((page) => {
        if (cancelled) return;
        const first = (page.items || [])[0] || null;
        setBusiness(first);
        if (first) setActiveBusiness(first);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, [activeBusiness, setActiveBusiness]);

  return { business, ready };
}