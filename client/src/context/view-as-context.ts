import { createContext } from 'react';
import { z } from 'zod';

/** Who the UI is "viewing as" (no auth in this assessment; this is the role switcher). */
export const viewAsSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hq') }).strict(),
  z.object({ kind: z.literal('outlet'), outletId: z.number().int().positive() }).strict(),
]);

export type ViewAs = z.infer<typeof viewAsSchema>;

export const HQ_VIEW: ViewAs = { kind: 'hq' };
export const VIEW_AS_STORAGE_KEY = 'techzu.viewAs';

export interface ViewAsContextValue {
  viewAs: ViewAs;
  setViewAs: (next: ViewAs) => void;
}

export const ViewAsContext = createContext<ViewAsContextValue | null>(null);
