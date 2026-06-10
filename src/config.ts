export const supabaseRuntimeConfig = {
  url: import.meta.env.VITE_SUPABASE_URL?.trim() || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "",
  storageBucket: import.meta.env.VITE_SUPABASE_ASSET_BUCKET?.trim() || "collection-assets"
};

export function hasSupabaseRuntimeConfig() {
  return Boolean(supabaseRuntimeConfig.url && supabaseRuntimeConfig.anonKey);
}
