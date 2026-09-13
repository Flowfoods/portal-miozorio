import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Suíte de INTEGRAÇÃO — roda contra um Postgres de verdade.
 *
 * Separada da suíte principal de propósito: `npm test` precisa continuar
 * rodando em qualquer lugar, sem banco (é o cenário do dev local do Rodolfo,
 * descrito no claude.md). Estes testes exigem `DATABASE_URL` e existem para
 * cobrir o que NÃO dá para testar com mock: a trava `EXCLUDE USING gist` que
 * impede double-booking (R2) mora no banco, e mockar o Prisma testaria o mock.
 *
 * Uso: `npm run test:db` (com DATABASE_URL apontando para um banco descartável).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.itest.ts"],
    // O banco é estado compartilhado: em paralelo os testes se atropelam.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
