import { AppShell } from "@/components/app-shell";
import { AcessoPendente } from "@/components/acesso-pendente";
import { createClient } from "@/lib/supabase/server";
import type { CardWithAlerts } from "@/lib/kanban/alerts";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Estar autenticado não basta: as policies exigem estar em `allowed_members`.
  // Quem não está veria tudo vazio, sem erro, porque o RLS filtra as linhas em
  // silêncio. A checagem fica aqui, e não em cada página, para cobrir board e
  // relatórios de uma vez.
  //
  // `is_team_member()` só tem EXECUTE para `authenticated` (o anon perdeu na
  // migration 20260811010000), então esta chamada só existe depois do login —
  // o proxy já barrou quem não tem sessão.
  const [{ data: liberado, error: erroLiberado }, { data: auth }] =
    await Promise.all([
      supabase.rpc("is_team_member"),
      supabase.auth.getUser(),
    ]);

  // Falha na chamada é diferente de "não liberado". Sem separar os dois, uma
  // queda de rede mostraria "peça liberação ao administrador" para alguém que
  // tem acesso — mensagem errada e confusa. Deixar estourar manda o caso para
  // o error.tsx, que oferece tentar de novo.
  if (erroLiberado) throw erroLiberado;

  if (liberado !== true) {
    return <AcessoPendente email={auth.user?.email} />;
  }

  // Only contracts with an end date can ever raise an alert, so the rest
  // never leave the database.
  //
  // D-08: contrato arquivado não gera alerta de vencimento — ele saiu de
  // operação, e um alerta sobre ele seria ruído. Filtro de topo, simples
  // (diferente da regra de visibilidade de parcela, D-06, que não se
  // expressa numa única query).
  const { data } = await supabase
    .from("cards")
    .select("*, alerts(card_id, type, trigger_date, status)")
    .not("periodo_fim", "is", null)
    .is("arquivado_em", null);

  const cards: CardWithAlerts[] = data ?? [];

  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <AppShell alertCards={cards} todayISO={todayISO}>
      {children}
    </AppShell>
  );
}
