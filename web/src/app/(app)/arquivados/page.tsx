import { createClient } from "@/lib/supabase/server"
import { ArquivadosView } from "@/components/arquivados/arquivados-view"

export default async function ArquivadosPage() {
  const supabase = await createClient()

  // Mais recente primeiro: o contrato que você mais provavelmente arquivou
  // por engano é o último. Cliente de sessão do servidor, nunca
  // `service_role` — o RLS `is_team_member()` já filtra as linhas, igual às
  // outras rotas.
  const { data, error } = await supabase
    .from("cards")
    .select("id, numero, endereco, proprietario, inquilino, valor, arquivado_em")
    .not("arquivado_em", "is", null)
    .order("arquivado_em", { ascending: false })

  const contratos = (data ?? []).filter(
    (contrato): contrato is typeof contrato & { arquivado_em: string } =>
      contrato.arquivado_em !== null
  )

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          Arquivados
        </h1>
        <p className="text-sm text-muted-foreground">
          Contratos fora de operação. Eles não aparecem no board, no
          Financeiro, nos relatórios nem nos alertas — e nada foi apagado.
        </p>
      </div>

      <ArquivadosView contratos={contratos} erroCarregamento={Boolean(error)} />
    </div>
  )
}
