import { useContext } from 'react';
import { ViewAsContext } from '@/context/view-as-context';
import type { ViewAsContextValue } from '@/context/view-as-context';

export const useViewAs = (): ViewAsContextValue => {
  const context = useContext(ViewAsContext);
  if (!context) throw new Error('useViewAs must be used inside <ViewAsProvider>');
  return context;
};
