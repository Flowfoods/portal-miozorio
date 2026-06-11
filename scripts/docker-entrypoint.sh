#!/bin/sh
# Entrypoint de produção (Dokploy). Aplica migrations pendentes, semeia banco
# virgem (--if-empty nunca sobrescreve dados editados no admin) e sobe o Next.
set -e

echo "[entrypoint] prisma migrate deploy"
node prisma-cli/node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] seed --if-empty"
node prisma/seed.js --if-empty

echo "[entrypoint] iniciando Next standalone"
exec node server.js
