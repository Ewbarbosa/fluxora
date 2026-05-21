import { AppShell } from "@/components/app-shell"
import { SectionPlaceholder } from "@/components/section-placeholder"

export default function WorkspacePage() {
  return (
    <AppShell title="Workspace" section="Configurações">
      <SectionPlaceholder
        eyebrow="Contexto do tenant"
        title="Configurações do workspace"
        description="Esta área deve concentrar dados do tenant, identidade básica e informações operacionais do ambiente."
        bullets={[
          "O backend já possui endpoints para consultar o tenant autenticado.",
          "Vale começar com dados de identificação e status do workspace.",
          "Integrações ficam fora por enquanto, porque colocar botão sem função é só decoração cara.",
        ]}
        links={[
          { label: "Abrir plano e limites", href: "/settings/limits" },
          { label: "Abrir equipe", href: "/settings/team" },
        ]}
      />
    </AppShell>
  )
}
