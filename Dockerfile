# Portal Mi Ozorio — imagem de produção (Next.js 14 standalone) para o Dokploy.
# Multi-stage: deps -> build -> runner enxuto.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Gera o Prisma Client e compila o Next em modo standalone.
RUN npx prisma generate
RUN npm run build
# Compila o seed para JS puro (o runner não tem tsx); tsc com arquivo explícito
# ignora o tsconfig do projeto, então o output fica isolado em /app/seed-dist.
RUN npx tsc prisma/seed.ts --outDir seed-dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# CLI do Prisma isolado para o `migrate deploy` do entrypoint. Instalar via npm
# garante a árvore completa (o CLI 6.x requer effect/@prisma/config etc. — copiar
# só node_modules/prisma do builder quebra com MODULE_NOT_FOUND).
FROM node:20-alpine AS prisma-cli
WORKDIR /cli
RUN apk add --no-cache openssl \
  && npm install prisma@6.19.3 --omit=dev --no-audit --no-fund

# sharp (processamento de fotos M8.4) com binários linuxmusl completos.
# Instalado num stage isolado e MESCLADO no node_modules do runner — o
# file-tracing do standalone já deixou bcryptjs de fora uma vez (lição M0.3);
# aqui garantimos sharp + deps (color, detect-libc, @img/*) deterministicamente.
FROM node:20-alpine AS sharp-deps
WORKDIR /s
RUN npm install sharp@0.35.1 --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV MEDIA_DIR=/app/media
RUN apk add --no-cache openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  # Fotos do site (M8.4): montar volume persistente do Dokploy AQUI.
  # Criado já com dono nextjs — volume nomeado herda a permissão no 1º mount.
  && mkdir -p /app/media && chown nextjs:nodejs /app/media

# Artefatos do build standalone.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma: schema + engines do client + CLI isolado p/ `migrate deploy`.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prisma-cli --chown=nextjs:nodejs /cli/node_modules ./prisma-cli/node_modules
# bcryptjs (puro JS): o file-tracing do standalone não o incluiu — usado pelo
# seed (hash do admin) e pelo authorize do NextAuth.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
# sharp + dependências (merge por cima do node_modules do standalone).
COPY --from=sharp-deps --chown=nextjs:nodejs /s/node_modules ./node_modules
# Seed compilado (idempotente; entrypoint roda com --if-empty).
COPY --from=builder --chown=nextjs:nodejs /app/seed-dist/seed.js ./prisma/seed.js
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
