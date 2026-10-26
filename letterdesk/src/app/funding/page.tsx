import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { q1 } from "@/lib/db";
import AppShell from "@/components/AppShell";
import FundingClient from "./FundingClient";

export const dynamic = "force-dynamic";

export default function FundingPage() {
  const session = getSessionFromCookies();
  if (!session) redirect("/login?next=/funding");
  const user = q1<{ name: string; email: string }>("SELECT name, email FROM users WHERE id=@id", { id: session.userId });
  return (
    <AppShell user={{ name: user?.name ?? "Student", email: session.email }}>
      <FundingClient />
    </AppShell>
  );
}
