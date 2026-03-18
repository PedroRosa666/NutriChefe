import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { email, password, full_name, user_type, redirectTo } = await req.json();

    if (!email || !password || !full_name || !user_type) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios ausentes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "Este e-mail já está cadastrado." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false,
      user_metadata: { full_name, user_type },
    });

    if (createError) {
      const msg = createError.message.toLowerCase();
      const isDuplicate = msg.includes("already") || msg.includes("exists");
      return new Response(
        JSON.stringify({ error: isDuplicate ? "Este e-mail já está cadastrado." : createError.message }),
        { status: isDuplicate ? 409 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalRedirectTo = redirectTo || `${supabaseUrl.replace('.supabase.co', '')}/confirmar-email`;

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
    const resendRes = await fetch(`${supabaseUrl}/auth/v1/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
      },
      body: JSON.stringify({
        type: "signup",
        email: normalizedEmail,
        options: { emailRedirectTo: finalRedirectTo },
      }),
    });

    return new Response(
      JSON.stringify({ success: true, emailSent: resendRes.ok }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro inesperado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
