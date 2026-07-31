import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import type { CardWithAlerts } from "@/lib/kanban/alerts";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Only contracts with an end date can ever raise an alert, so the rest
  // never leave the database.
  const { data } = await supabase
    .from("cards")
    .select("*, alerts(card_id, type, trigger_date, status)")
    .not("periodo_fim", "is", null);

  const cards: CardWithAlerts[] = data ?? [];

  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <AppShell alertCards={cards} todayISO={todayISO}>
      {children}
    </AppShell>
  );
}
