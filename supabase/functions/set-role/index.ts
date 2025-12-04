import { createClient } from "npm:@supabase/supabase-js@2.33.0";

const supabaseAdmin = createClient(
  Deno.env.get("MY_SUPABASE_URL")!,
  Deno.env.get("MY_SERVICE_ROLE_KEY")!
);

const ADMIN_SECRET = Deno.env.get("EDGE_ADMIN_SECRET") || "";

Deno.serve(async (req: Request) => {
  try {
    // Proteção simples: header secreto
    const providedSecret = req.headers.get("x-admin-secret") || "";
    if (!ADMIN_SECRET || providedSecret !== ADMIN_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => null);
    const user_id = body?.user_id ?? body?.userId;
    const role = body?.role;

    if (!user_id || !role) {
      return new Response(JSON.stringify({ error: "user_id and role are required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Use app_metadata para roles por padrão
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      app_metadata: { role }
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, data }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});