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

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN apk add --no-cache openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Artefatos do build standalone.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma: schema + engines + CLI para `migrate deploy` no entrypoint.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
# Seed compilado (idempotente; entrypoint roda com --if-empty).
COPY --from=builder --chown=nextjs:nodejs /app/seed-dist/seed.js ./prisma/seed.js
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
