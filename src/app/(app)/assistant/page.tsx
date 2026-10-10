import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isManagerRole } from "@/lib/auth/rank";
import AgentChat from "@/components/AgentChat";
import { getLocale } from "@/lib/i18n/server";
import { messages } from "@/lib/i18n/messages";

// Phase 1 ops assistant page. Dark unless AGENT_CHAT_ENABLED=true, manager+ only.
// notFound() rather than a visible "disabled" page so it leaves no trace when off.
export default async function AssistantPage() {
  if (process.env.AGENT_CHAT_ENABLED !== "true") notFound();

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) notFound();
  const { data: me } = await sb.from("users").select("role").eq("id", user.id).single();
  if (!me || !isManagerRole(me.role)) notFound();

  const locale = await getLocale();
  const a = (messages as any)[locale]?.assistant ?? messages.en.assistant;

  return (
    <div className="screen">
      <h1 className="page-title">{a.title}</h1>
      <p style={{ opacity: 0.7, marginTop: -4, marginBottom: 16, fontSize: 14 }}>{a.subtitle}</p>
      <AgentChat />
    </div>
  );
}
