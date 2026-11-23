import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { isApiError } from '@/api/http';
import { Toaster } from '@/components/ui/sonner';
import { ViewAsProvider } from '@/context/ViewAsProvider';
import { App } from './App';

const MAX_RETRIES = 1;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retrying a 4xx (validation, not found) cannot succeed; only retry network/5xx once.
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
        return failureCount < MAX_RETRIES;
      },
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ViewAsProvider>
          <App />
        </ViewAsProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
