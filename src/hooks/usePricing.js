import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';

// ── Shared pricing query ─────────────────────────────────────────────────────
// IMPORTANT: This is the single source of truth for the ['pricing'] query key.
// Any component fetching plan pricing MUST use this hook (not its own inline
// useQuery with the same key) — otherwise React Query will serve one
// component's cached shape to another and silently corrupt prices
// (this caused every plan's checkout to show the monthly price).
//
// Returns a normalized shape with BOTH naming conventions so every consumer
// works regardless of which style they read:
//   { monthly, annual, biannual, monthly_price, annual_price, biannual_price }
export function usePricing() {
  return useQuery({
    queryKey: ['pricing'],
    queryFn: async () => {
      const rows = await db.entities.PlatformSettings.filter({ key: 'pricing' }).catch(() => []);
      const val = rows?.[0]?.value;
      const cfg = val?.data?.pricing || val?.pricing || val || {};

      const monthly  = cfg.monthly_price  ?? cfg.monthly  ?? 10000;
      const annual   = cfg.annual_price   ?? cfg.annual   ?? 80000;
      const biannual = cfg.biannual_price ?? cfg.biannual ?? 150000;

      return {
        monthly, annual, biannual,
        monthly_price: monthly, annual_price: annual, biannual_price: biannual,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
