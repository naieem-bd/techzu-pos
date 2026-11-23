import { toast } from 'sonner';

/** Shows the server's error message (ApiError carries it as `message`) in a toast. */
export const toastError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  toast.error(message);
};
