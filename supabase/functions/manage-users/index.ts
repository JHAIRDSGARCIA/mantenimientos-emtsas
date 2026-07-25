import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerProfile } = await userClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Solo los administradores pueden gestionar usuarios" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    if (req.method === "POST") {
      const body = await req.json();
      const { email, password, full_name, role } = body;
      if (!email || !password || !role || !full_name) return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!["admin", "supervisor", "technician"].includes(role)) return new Response(JSON.stringify({ error: "Rol inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, role } });
      if (createError) return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error: profileError } = await adminClient.from("profiles").upsert({ id: newUser.user.id, email, full_name, role, active: true });
      if (profileError) return new Response(JSON.stringify({ error: "Usuario creado pero perfil falló: " + profileError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, user: { id: newUser.user.id, email, full_name, role } }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "GET" && action === "list") {
      const { data, error } = await adminClient.from("profiles").select("id, email, full_name, role, active, created_at").order("created_at", { ascending: false });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ users: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const { id, full_name, role, active } = body;
      if (!id) return new Response(JSON.stringify({ error: "ID de usuario requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const updateData: Record<string, unknown> = {};
      if (full_name !== undefined) updateData.full_name = full_name;
      if (role !== undefined) { if (!["admin", "supervisor", "technician"].includes(role)) return new Response(JSON.stringify({ error: "Rol inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); updateData.role = role; }
      if (active !== undefined) updateData.active = active;
      const { error } = await adminClient.from("profiles").update(updateData).eq("id", id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "DELETE") {
      const userId = url.searchParams.get("id");
      if (!userId) return new Response(JSON.stringify({ error: "ID de usuario requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Método no soportado" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error desconocido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
