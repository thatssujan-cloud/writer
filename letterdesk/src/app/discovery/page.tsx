import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { q1 } from "@/lib/db";
import AppShell from "@/components/AppShell";
import DiscoveryClient from "./DiscoveryClient";

export const dynamic = "force-dynamic";

export default function DiscoveryPage({ searchParams }: { searchParams: { saved?: string } }) {
  const session = getSessionFromCookies();
  if (!session) redirect("/login?next=/discovery");
  const user = q1<{ name: string; email: string }>("SELECT name, email FROM users WHERE id=@id", { id: session.userId });
  return (
    <AppShell user={{ name: user?.name ?? "Student", email: session.email }}>
      <DiscoveryClient initialSaved={searchParams.saved === "1"} />
    </AppShell>
  );
}
