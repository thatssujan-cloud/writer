import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { q1 } from "@/lib/db";
import AppShell from "@/components/AppShell";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const session = getSessionFromCookies();
  if (!session) redirect("/login?next=/settings");
  const user = q1<{ name: string; email: string }>("SELECT name, email FROM users WHERE id=@id", { id: session.userId });
  return (
    <AppShell user={{ name: user?.name ?? "Student", email: session.email }}>
      <SettingsClient email={session.email} />
    </AppShell>
  );
}
