/** Supabase Edge Function: send-push
 *
 * Chamada pelo banco (gatilho trg_dispatch_push, via pg_net) com { notification_id } quando um
 * aviso é criado. Marca o aviso como enviado (claim_push: só uma vez, só avisos recentes e não lidos)
 * e manda a notificação para todos os aparelhos inscritos da pessoa. Inscrições que não existem
 * mais (404/410) são apagadas.
 *
 * Segredos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT (ex.: mailto:contato@...).
 * Publicar com: supabase functions deploy send-push --no-verify-jwt
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import webpush from "npm:web-push@3.6.7";

type Data = {
  name?: string;
  client_id?: string;
  item?: string;
  status?: "approved" | "rejected";
  offered?: boolean;
  title?: string;
  new?: boolean;
  preview?: string;
  from_nutritionist?: boolean;
  starts_at?: string;
  rescheduled?: boolean;
  crn?: string;
  approved?: boolean;
  reason?: string;
  body?: string;
};

// Data da consulta no horário de Brasília (ex.: "qui., 23/10, 14:30").
const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : "";

// Mesmos textos do sino do app (src/lib/i18n/translations.ts, notifications), em português.
function message(kind: string, d: Data, recipient: string): { title: string; body: string; url: string } {
  const name = d.name || "Alguém";
  const item = (d.item ?? "").split(" — ")[0];
  const patientUrl = d.client_id ? `/perfil?tab=patients&paciente=${d.client_id}` : "/perfil?tab=patients";
  // Consultas: o paciente vê no painel; o nutricionista, no detalhe do paciente.
  const appointmentUrl = d.client_id && d.client_id !== recipient ? patientUrl : "/perfil";
  switch (kind) {
    case "swap_requested":
      return { title: "Pedido de troca", body: `${name} pediu para trocar "${item}"`, url: patientUrl };
    case "swap_answered":
      return {
        title: "Troca respondida",
        body:
          d.status === "approved"
            ? `${name} aprovou sua troca de "${item}"`
            : d.offered
            ? `${name} recusou sua troca de "${item}" e colocou outra opção no plano`
            : `${name} recusou sua troca de "${item}"`,
        url: "/perfil?tab=plan",
      };
    case "patient_joined":
      return { title: "Novo paciente", body: `${name} aceitou seu convite e agora é seu paciente`, url: patientUrl };
    case "link_ended":
      return { title: "Acompanhamento encerrado", body: `${name} encerrou o acompanhamento`, url: "/perfil" };
    case "plan_updated":
      return {
        title: d.new ? "Plano alimentar novo" : "Plano alimentar atualizado",
        body: d.new ? `${name} criou um plano alimentar para você: ${d.title ?? ""}` : `${name} atualizou seu plano alimentar: ${d.title ?? ""}`,
        url: "/perfil?tab=plan",
      };
    case "appointment_scheduled":
      return {
        title: d.rescheduled ? "Consulta remarcada" : "Consulta marcada",
        body: d.rescheduled ? `${name} remarcou sua consulta para ${when(d.starts_at)}` : `${name} marcou uma consulta: ${when(d.starts_at)}`,
        url: appointmentUrl,
      };
    case "appointment_canceled":
      return { title: "Consulta cancelada", body: `${name} cancelou a consulta de ${when(d.starts_at)}`, url: appointmentUrl };
    case "appointment_reminder":
      return { title: "Lembrete de consulta", body: `Consulta com ${name} em ${when(d.starts_at)}`, url: appointmentUrl };
    case "plan_item_removed":
      return d.client_id
        ? { title: "Item removido de um plano", body: `"${d.item ?? ""}" saiu do plano de ${name}: foi apagado do catálogo`, url: patientUrl }
        : { title: "Item removido do seu plano", body: `"${d.item ?? ""}" foi apagado do catálogo e saiu do plano "${d.title ?? ""}"`, url: "/perfil?tab=plan" };
    case "announcement":
      return { title: d.title || "NutriChef", body: d.body ?? "", url: "/" };
    case "verification_requested":
      return { title: "CRN para conferir", body: `${name} (${d.crn ?? ""}) enviou os documentos`, url: "/admin?tab=crn" };
    case "verification_reviewed":
      return d.approved
        ? { title: "CRN verificado", body: "Seu CRN foi verificado. Você já pode convidar pacientes.", url: "/perfil" }
        : { title: "Verificação do CRN", body: `Não aprovada: ${d.reason ?? ""}`, url: "/perfil" };
    case "message":
      return {
        title: name,
        body: d.preview ?? "Nova mensagem",
        url: d.from_nutritionist ? "/perfil?tab=messages" : `${patientUrl}&chat=1`,
      };
    case "goals_updated":
      return { title: "Metas atualizadas", body: `${name} definiu novas metas diárias para você`, url: "/perfil?tab=nutrition" };
    default:
      return { title: "NutriChef", body: "Você tem um aviso novo.", url: "/perfil" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let notificationId: string | undefined;
  try {
    notificationId = (await req.json())?.notification_id;
  } catch {
    // corpo inválido
  }
  if (!notificationId || !/^[0-9a-f-]{36}$/i.test(notificationId)) return new Response("Bad request", { status: 400 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Só envia uma vez, e só para avisos recentes e não lidos (quem chamar com um id qualquer não consegue nada).
  const { data: claimed, error: claimError } = await supabase.rpc("claim_push", { p_notification: notificationId });
  if (claimError) {
    console.error("claim_push failed", claimError.message);
    return new Response("Error", { status: 500 });
  }
  const notification = (claimed as any[] | null)?.[0];
  if (!notification) return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notification.user_id);
  if (subsError) {
    console.error("load subscriptions failed", subsError.message);
    return new Response("Error", { status: 500 });
  }

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@nutrichef.app",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const msg = message(notification.kind, notification.data ?? {}, notification.user_id);
  const payload = JSON.stringify({ ...msg, tag: `${notification.kind}:${notification.ref_id ?? notification.id}` });

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("push failed", error?.statusCode, error?.body ?? error?.message);
        }
      }
    }),
  );

  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
