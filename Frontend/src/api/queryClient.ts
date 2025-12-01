// src/api/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized React Query client configuration (Phase 4 Enhanced)
 * 
 * Optimizations:
 * - Extended staleTime for catalog data (rarely changes)
 * - Aggressive caching with gcTime for offline-like experience
 * - Retry logic with exponential backoff
 * - Network mode for better offline handling
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Phase 4: Match backend Redis cache TTL (10 minutes for catalog)
      staleTime: 1000 * 60 * 10, // 10 minutes (increased from 5)
      
      // Phase 4: Keep data in cache longer for instant navigation
      gcTime: 1000 * 60 * 30, // 30 minutes (garbage collection time)
      
      // Phase 4: Don't refetch on window focus (backend has cache)
      refetchOnWindowFocus: false,
      
      // Phase 4: Don't refetch on reconnect (data likely still fresh)
      refetchOnReconnect: false,
      
      // Phase 4: Smart retry with exponential backoff
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 2 times for network/server errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Phase 4: Use cached data while revalidating in background
      networkMode: 'online',
    },
    mutations: {
      // Phase 4: Retry mutations once on network errors
      retry: 1,
      retryDelay: 1000,
      
      // Phase 4: Better error handling for mutations
      networkMode: 'online',
    },
  },
});

/**
 * Phase 4: Query key factory for consistent cache keys
 * 
 * This ensures consistent cache keys across the app and makes
 * invalidation easier and more reliable.
 */
export const queryKeys = {
  // Catalog keys (high TTL, matches backend cache)
  catalog: {
    services: ['catalog', 'services'] as const,
    extras: ['catalog', 'extras'] as const,
  },
  
  // User keys (medium TTL)
  users: {
    all: ['users'] as const,
    detail: (id: string) => ['users', id] as const,
    vehicles: (id: string) => ['users', id, 'vehicles'] as const,
  },
  
  // Order keys (low TTL, frequently changing)
  orders: {
    all: ['orders'] as const,
    active: ['orders', 'active'] as const,
    detail: (id: string) => ['orders', id] as const,
    user: (id: string) => ['orders', 'user', id] as const,
  },
  
  // Wash keys (real-time data)
  washes: {
    active: ['washes', 'active'] as const,
    detail: (id: string) => ['washes', id] as const,
  },
  
  // Analytics keys (medium TTL, backend cached)
  analytics: {
    dashboard: ['analytics', 'dashboard'] as const,
    business: ['analytics', 'business'] as const,
  },
  
  // Loyalty keys (medium TTL)
  loyalty: {
    me: ['loyalty', 'me'] as const,
    rewards: ['loyalty', 'rewards'] as const,
  },
} as const;
