import { useState, useEffect, useCallback } from 'react';

// Simple global store using module-level state + listeners
let state = { activeBusiness: null };
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn({ ...state }));
}

export function useBusinessStore() {
  const [local, setLocal] = useState({ ...state });

  useEffect(() => {
    const handler = (s) => setLocal(s);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const setActiveBusiness = useCallback((business) => {
    state.activeBusiness = business;
    notify();
  }, []);

  return { activeBusiness: local.activeBusiness, setActiveBusiness };
}