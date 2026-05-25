"use strict";

const userAgent = process.env.npm_config_user_agent || "";
const execPath = process.env.npm_execpath || "";
const usingPnpm = userAgent.includes("pnpm/") || execPath.includes("pnpm");

if (usingPnpm) {
  process.exit(0);
}

const message = `
Fluxora usa pnpm neste monorepo.

Nao rode "npm install" dentro de apps/api ou apps/web.

Use:
  corepack enable
  corepack pnpm install
  corepack pnpm --filter @fluxora/api start:dev

Se preferir frontend:
  corepack pnpm --filter @fluxora/web dev
`;

console.error(message.trim());
process.exit(1);
