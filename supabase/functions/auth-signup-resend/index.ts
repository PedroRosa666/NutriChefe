import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, redirectTo } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "E-mail obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const finalRedirectTo = redirectTo || `${Deno.env.get("FRONTEND_URL") || ""}/confirmar-email`;

    const supabaseAnon = createClient(supabaseUrl, anonKey);
    const { error: resendError } = await supabaseAnon.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo: finalRedirectTo },
    });

    if (resendError) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email: normalizedEmail,
        options: { redirectTo: finalRedirectTo },
      });

      if (linkData?.properties?.hashed_token) {
        const token = linkData.properties.hashed_token;
        const confirmationLink = `${supabaseUrl}/auth/v1/verify?token=${token}&type=signup&redirect_to=${encodeURIComponent(finalRedirectTo)}`;

        return new Response(
          JSON.stringify({ success: true, confirmationLink }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: resendError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro inesperado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
