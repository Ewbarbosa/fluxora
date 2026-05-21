# Fluxora — ROADMAP.md

## Objetivo

Transformar o módulo financeiro do Lawmanager em um produto validável, com proposta própria e aderência a pequenas empresas de serviço.

## Fase 0 — Fundação ✅
- reaproveitar estrutura e regras já existentes do módulo financeiro
- mapear o que já está pronto versus o que depende de adaptação
- remover dependências conceituais do contexto jurídico onde necessário
- consolidar naming, proposta e escopo inicial
- definir stack e estrutura inicial do monorepo

## Fase 1 — Extração e MVP operacional

### Extração técnica
- subir `apps/api` com base no `lawmanager-api`
- subir `apps/web` com base no `lawmanager-frontend`
- extrair o núcleo do módulo financeiro
- mapear dependências mínimas obrigatórias (auth, tenant, users, permissões)
- remover ou neutralizar acoplamentos jurídicos desnecessários

### Escopo funcional mínimo
- receitas e despesas
- categorias financeiras
- status de pagamento
- recorrência
- parcelamento
- notificações de atraso
- visão/listagem por período
- resumo financeiro essencial

## Fase 2 — Clareza gerencial
- fluxo de caixa projetado
- competência x caixa
- dashboard financeiro mais forte
- filtros e visão por período, categoria e status
- refinamento da identidade do produto fora do contexto Lawmanager

## Fase 3 — Maturidade de produto
- cobrança mais robusta
- automações operacionais
- conciliação
- integrações bancárias
- trilha comercial e onboarding próprio
- piloto com empresas reais e priorização guiada por uso

## Perguntas abertas
1. Fluxora será spin-off imediato ou incubado dentro do Lawmanager por mais tempo?
2. Quais entidades do módulo atual ainda dependem de contexto jurídico?
3. O billing e onboarding serão herdados integralmente do ecossistema atual?
4. Qual será a primeira persona exata de validação?
5. O MVP inicial será white-label interno ou produto com marca própria desde o começo?
