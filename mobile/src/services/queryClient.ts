import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/errors';

/** Server-state cache. Cleared on logout (authStore). Retries only transient failures, never 4xx. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false, // RN has no window focus; app-state refetch is handled in the app shell
      retry: (count, err) => !(err instanceof ApiError && err.status && err.status < 500) && err.message !== 'CANCELLED' && count < 2,
    },
    mutations: { retry: false },
  },
});
