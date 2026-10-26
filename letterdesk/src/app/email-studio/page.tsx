import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { aiConfigured } from "@/lib/ai-provider";
import type { Researcher } from "@/lib/types";
import AppShell from "@/components/AppShell";
import StudioClient from "./StudioClient";

export const dynamic = "force-dynamic";

export default function EmailStudioPage({ searchParams }: { searchParams: { researcher?: string; draft?: string } }) {
  const session = getSessionFromCookies();
  if (!session) redirect("/login?next=/email-studio");
  const uid = session.userId;
  const user = q1<{ name: string; email: string }>("SELECT name, email FROM users WHERE id=@id", { id: uid });

  const rows = q<{ payload: string }>("SELECT payload FROM saved_researchers WHERE user_id=@uid ORDER BY saved_at DESC", { uid });
  const researchers: Researcher[] = [];
  for (const row of rows) {
    try { researchers.push(JSON.parse(row.payload) as Researcher); } catch { /* skip broken record */ }
  }

  let profile: Record<string, unknown> | null = null;
  const profRow = q1<{ data: string }>("SELECT data FROM academic_profiles WHERE user_id=@uid", { uid });
  if (profRow) { try { profile = JSON.parse(profRow.data); } catch { profile = null; } }

  const draftId = Number(searchParams.draft);
  return (
    <AppShell user={{ name: user?.name ?? "Student", email: session.email }}>
      <StudioClient
        researchers={researchers}
        profile={profile}
        draftId={Number.isInteger(draftId) ? draftId : null}
        preselect={searchParams.researcher ? decodeURIComponent(searchParams.researcher) : null}
        aiConfigured={aiConfigured()}
      />
    </AppShell>
  );
}
