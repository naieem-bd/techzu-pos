import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAllOutlets } from '@/hooks/use-outlets';
import { readStorage, writeStorage } from '@/lib/storage';
import { HQ_VIEW, VIEW_AS_STORAGE_KEY, ViewAsContext, viewAsSchema } from './view-as-context';
import type { ViewAs } from './view-as-context';

/** Anything unreadable or malformed in storage falls back to HQ. */
const loadInitialViewAs = (): ViewAs => {
  const raw = readStorage(VIEW_AS_STORAGE_KEY);
  if (!raw) return HQ_VIEW;
  try {
    const parsed = viewAsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : HQ_VIEW;
  } catch {
    return HQ_VIEW;
  }
};

export const ViewAsProvider = ({ children }: { children: ReactNode }) => {
  const [viewAs, setViewAsState] = useState<ViewAs>(loadInitialViewAs);
  const outlets = useAllOutlets();

  const setViewAs = useCallback((next: ViewAs) => {
    setViewAsState(next);
    writeStorage(VIEW_AS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  // A stored outlet that no longer exists (e.g. after a DB reset) falls back to HQ.
  useEffect(() => {
    if (viewAs.kind !== 'outlet' || !outlets.data) return;
    const exists = outlets.data.data.some((outlet) => outlet.id === viewAs.outletId);
    if (!exists) setViewAs(HQ_VIEW);
  }, [viewAs, outlets.data, setViewAs]);

  const value = useMemo(() => ({ viewAs, setViewAs }), [viewAs, setViewAs]);
  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
};
