import { AppShell } from "@/components/app-shell"
import { SectionPlaceholder } from "@/components/section-placeholder"

export default function LimitsPage() {
  return (
    <AppShell title="Plano e limites" section="Configurações">
      <SectionPlaceholder
        eyebrow="Modelo SaaS"
        title="Plano e limites de uso"
        description="Aqui vamos mostrar consumo real do workspace, trial ativo e travas do plano. Sem teatrinho corporativo."
        bullets={[
          "O backend já expõe uso atual do tenant em /limits/usage.",
          "Também existe sincronização de contadores para revisar divergências.",
          "Essa área é útil cedo porque conversa direto com o modelo free + trial definido para o produto.",
        ]}
        links={[
          { label: "Abrir workspace", href: "/settings/workspace" },
          { label: "Ver equipe", href: "/settings/team" },
        ]}
      />
    </AppShell>
  )
}
