# Fluxora — Planning

## Estado atual

- **Fase 0 concluída:** naming, direção de produto, stack e estrutura inicial do monorepo já definidos.
- **Próximo foco:** transformar a base existente do Lawmanager em um MVP próprio do Fluxora.

## Sequência recomendada

### Fase 1 — Extração do núcleo técnico
Objetivo: colocar o coração do produto para bater fora do Lawmanager.

#### Backend
- subir `apps/api` com base no `lawmanager-api`
- extrair o módulo financeiro
- mapear dependências mínimas obrigatórias:
  - auth
  - users
  - profiles/permissões
  - tenant
  - categorias financeiras
- identificar e remover acoplamentos jurídicos desnecessários
- manter opcional, ou remover nesta fase:
  - processo
  - contato vinculado a processo
  - agenda
  - dashboard não financeiro

#### Frontend
- subir `apps/web` com base no `lawmanager-frontend`
- trazer a área de financeiro como núcleo inicial
- preservar o design system já existente que for reaproveitável
- remover navegação e telas sem relação com o MVP financeiro

#### Entregável da fase
- backend e frontend rodando localmente no monorepo
- financeiro operacional funcionando como produto independente em ambiente dev

---

### Fase 2 — Neutralização do domínio Lawmanager
Objetivo: parar de parecer “Lawmanager com outro nome”.

#### Itens principais
- renomear textos, labels e contexto de negócio
- revisar schema e entidades vinculadas ao jurídico
- decidir o destino de `contact` e `process` no financeiro:
  - virar `customer/client`
  - virar relacionamento genérico
  - ou sair temporariamente do MVP
- limpar rotas, menus e permissões irrelevantes

#### Entregável da fase
- base funcional já com identidade de produto própria
- redução clara de dependências conceituais do nicho jurídico

---

### Fase 3 — MVP validável
Objetivo: fechar o pacote mínimo que faz sentido para teste real.

#### Escopo funcional do MVP
- receitas e despesas
- categorias
- status de pagamento
- recorrência
- parcelamento
- alertas/notificações de atraso
- listagem por período
- resumo financeiro essencial

#### Decisões de produto nesta fase
- definir primeira persona exata
- definir fluxo mínimo de onboarding
- decidir se o MVP terá billing ativo desde o início ou só uso interno/piloto

#### Entregável da fase
- versão demonstrável para piloto
- narrativa clara de valor

---

### Fase 4 — Piloto e validação
Objetivo: testar com caso real sem fingir escala antes da hora.

#### Itens principais
- subir ambiente utilizável
- testar operação com 1 a 3 empresas
- coletar fricções reais
- validar aderência da tese de “financeiro operacional para serviços”
- medir o que falta para uso recorrente

#### Entregável da fase
- feedback real de uso
- backlog priorizado por dor real, não por imaginação fértil

---

### Fase 5 — Evolução pós-validação
Objetivo: amadurecer o produto depois que a tese se provar.

#### Trilhas prováveis
- fluxo de caixa projetado
- competência x caixa
- cobrança mais robusta
- automações
- conciliação
- integrações bancárias
- onboarding comercial próprio
- billing estruturado

## Ordem prática recomendada agora

1. **Extrair backend primeiro**
2. **Subir frontend em seguida**
3. **Neutralizar domínio jurídico**
4. **Fechar MVP**
5. **Validar com piloto real**

## Decisões que ainda precisamos tomar

1. `contact` vira cliente genérico ou sai do MVP?
2. `process` será eliminado do financeiro desde já?
3. billing entra no MVP ou fica para depois da validação?
4. o primeiro piloto será interno, parceiro próximo ou cliente pagante?

## Recomendação objetiva

Se quiser velocidade com o menor risco, o caminho é:
- **começar pelo backend**
- **isolar o financeiro**
- **cortar dependências jurídicas cedo**
- **evitar expandir escopo antes do primeiro piloto**

Em português claro: sem ERP messiânico, sem feature shopping, sem cair de boca no supérfluo.
