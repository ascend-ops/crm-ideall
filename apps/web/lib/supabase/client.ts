// lib/supabase/client.ts - SUBSTITUA POR ESTE CÓDIGO
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Use esta função no seu LoginForm
export const supabase = createClient()