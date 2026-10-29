/**
 * Contas de demonstração (Laboratório do administrador e demonstração pública /demo).
 * Usadas pelas Edge Functions `admin` e `demo`, sempre com o cliente service role.
 */
// deno-lint-ignore-file no-explicit-any

const randomPassword = () => crypto.randomUUID() + crypto.randomUUID();

export async function createDemoUser(supabase: any, email: string, fullName: string, userType: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { full_name: fullName, user_type: userType },
  });
  if (error) throw error;
  // O perfil é criado pelo gatilho do cadastro; marca como demo logo em seguida.
  await supabase.from("profiles").update({ is_demo: true }).eq("id", data.user.id);
  return data.user.id;
}

export async function deleteUser(supabase: any, id: string | null | undefined) {
  if (!id) return;
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error && !/not.?found/i.test(error.message)) throw error;
}

async function planId(supabase: any, feature: string): Promise<string | null> {
  const { data } = await supabase.from("subscription_plans").select("id, features").eq("is_active", true);
  const plans = (data ?? []) as { id: string; features: string[] }[];
  const pick = feature === "nutritionist_pro"
    ? plans.find((p) => p.features?.includes("nutritionist_pro"))
    : plans.find((p) => p.features?.includes("ai_mentoring") && !p.features?.includes("nutritionist_pro"));
  return pick?.id ?? null;
}

export async function setDemoPremium(supabase: any, userId: string, feature: string, on: boolean) {
  await supabase.from("user_subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", userId).is("stripe_subscription_id", null).eq("status", "active");
  if (!on) return;
  const plan = await planId(supabase, feature);
  if (!plan) throw new Error("plan_not_found");
  const { error } = await supabase.from("user_subscriptions").insert({ user_id: userId, plan_id: plan, status: "active", auto_renew: false });
  if (error) throw error;
}

/** Token para entrar na conta (o app troca por sessão com verifyOtp). */
export async function loginToken(supabase: any, userId: string): Promise<string | null> {
  const { data: target } = await supabase.auth.admin.getUserById(userId);
  const email = target?.user?.email;
  if (!email) return null;
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return data.properties?.hashed_token ?? null;
}
