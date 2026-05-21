import { AppShell } from "@/components/app-shell"
import { SectionPlaceholder } from "@/components/section-placeholder"

export default function TeamPage() {
  return (
    <AppShell title="Equipe e acessos" section="Configurações">
      <SectionPlaceholder
        eyebrow="Usuários e perfis"
        title="Equipe e permissões"
        description="Aqui entra a gestão de usuários, perfis e acessos do workspace, sem misturar isso com fantasia de enterprise."
        bullets={[
          "O backend já possui endpoints para usuários e perfis.",
          "Essa área deve cobrir convite/cadastro, permissões e revisão de acessos.",
          "Notificações e segurança avançada podem vir depois, quando deixarem de ser PowerPoint.",
        ]}
        links={[
          { label: "Abrir workspace", href: "/settings/workspace" },
          { label: "Ver visão geral", href: "/dashboard" },
        ]}
      />
    </AppShell>
  )
}
