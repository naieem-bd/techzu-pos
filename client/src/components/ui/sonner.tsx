import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

export const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="top-right"
    richColors
    closeButton
    toastOptions={{ style: { fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' } }}
    {...props}
  />
);
