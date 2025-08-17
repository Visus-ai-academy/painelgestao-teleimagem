// SECURITY: Restrict CORS to specific domains instead of wildcard
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://atbvikgxdcohnznkmaus.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}