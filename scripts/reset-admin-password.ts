/**
 * Reset/seed SEGURO da senha do admin do painel (/admin) — caminho OFICIAL de
 * reset. NÃO hardcoda senha: e-mail e senha vêm de variáveis de ambiente em
 * runtime. Nunca imprime a senha nem o hash.
 *
 * Uso (a senha entra na hora, sem default, sem ficar em arquivo versionado):
 *   ADMIN_EMAIL="email-da-mi@..." NEW_ADMIN_PASSWORD="********" npx tsx scripts/reset-admin-password.ts
 *
 * Opcional: ADMIN_NAME="Mi" (usado só ao CRIAR a conta).
 *
 * O que faz: upsert do admin_users — gera o hash com bcryptjs/rounds 12 (mesma
 * config do login em src/lib/auth.ts e actions.ts), normaliza o e-mail
 * (trim + lowercase, igual ao authorize) e ZERA o lockout (failedAttempts /
 * lockedUntil), resolvendo também conta travada por brute-force.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const MIN_SENHA = 12; // espelha MIN_SENHA em src/lib/security.ts
const BCRYPT_ROUNDS = 12; // espelha bcrypt.hashSync(..., 12) do login

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.NEW_ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Mi";

  if (!email) {
    console.error('✗ Defina ADMIN_EMAIL no ambiente (ex.: ADMIN_EMAIL="mi@...").');
    process.exit(1);
  }
  if (!password || password.length < MIN_SENHA) {
    console.error(
      `✗ Defina NEW_ADMIN_PASSWORD (em runtime) com pelo menos ${MIN_SENHA} caracteres.`,
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    await prisma.adminUser.upsert({
      where: { email },
      update: {
        passwordHash,
        active: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
      create: { email, name, passwordHash },
    });
    // Nunca logar senha nem hash.
    console.log(`✅ senha atualizada para ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(
    "✗ Falha ao resetar a senha do admin:",
    e instanceof Error ? e.message : String(e),
  );
  process.exit(1);
});
