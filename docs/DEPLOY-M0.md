# Runbook M0.3 / M0.4 — Deploy do Portal Mi Ozorio (Dokploy)

> VPS Hostinger `76.13.230.78` · Dokploy v0.29.1 · Traefik (Let's Encrypt).
> ⚠️ Senhas/segredos **só no Dokploy**, nunca neste arquivo nem no Git (R9).

## Pré-requisitos
- Repo `portal-miozorio` no GitHub (org Flowfoods) + branch de deploy.
- Projeto Dokploy: usar o existente ou criar `miozorio`.

---

## M0.3 — Banco `pg-miozorio` (PostgreSQL 16)

### 1. Criar o serviço de banco
Dokploy → projeto → **Create Service → Database → PostgreSQL**.
- **Name:** `pg-miozorio`
- **Image:** `postgres:16` (pinar a versão — a extensão `btree_gist` da constraint
  `no_overlap` depende disso; R2)
- **Database:** `miozorio` · **User:** `miozorio`
- **Password:** *(gerado — colar no Dokploy, NÃO commitar)*
- **Volume persistente:** ativar (ex.: `pg-miozorio-data` → `/var/lib/postgresql/data`)
- **Porta:** **não expor publicamente** — acesso só pela rede interna Docker.

### 2. DATABASE_URL para o app
No app `portal-miozorio` (aba Environment):
```
DATABASE_URL=postgresql://miozorio:<SENHA>@pg-miozorio:5432/miozorio?schema=public
```
(hostname interno = nome do serviço na rede Docker do Dokploy.)

### 3. Backup diário 04:00 (retenção 14d)
Script: `scripts/backup-pg-miozorio.sh`. Instalar como **Scheduled Task** no Dokploy
OU cron do host:
```
0 4 * * * POSTGRES_USER=miozorio POSTGRES_DB=miozorio /opt/scripts/backup-pg-miozorio.sh >> /var/log/backup-miozorio.log 2>&1
```
**Testar restore** num container temporário antes de considerar pronto (DoD M0).

---

## App `portal-miozorio` (Next.js)
- **Create Service → Application** → Source = GitHub (repo + branch) → Build Type =
  **Dockerfile** (`./Dockerfile`, já no repo, build standalone).
- **Environment:** copiar de `.env.example` (valores reais no Dokploy).
- **Migrations + seed são automáticos:** o entrypoint do container roda
  `prisma migrate deploy` e `seed --if-empty` (só semeia banco virgem) antes de
  subir o Next — nada manual após o deploy.
- **Admin (M5):** com `ADMIN_EMAIL`/`ADMIN_PASSWORD` no environment, o seed cria
  a conta do painel `/admin` no primeiro boot (não sobrescreve se já existir).
- **Healthcheck:** `GET /api/health` → `{ app, db, version }` (200 = ok).

---

## M0.4 — Domínio + SSL (AGUARDANDO — Rodolfo registra via Registro.br)
Domínio real: `miozorio.com.br` (Registro.br). Passos:
1. Registro.br → registro **A** do host → `76.13.230.78`.
2. Dokploy → app → **Domains → Add Domain** → HTTPS on → **Let's Encrypt** (port 3000).
3. Redirect www→raiz e http→https.
4. Se o cert não emitir após o DNS propagar: **Servidor Web → Traefik → Reload**
   (força reemissão ACME — lição aprendida no Megashopper).

## Verificação pós-deploy
```
curl -I https://<dominio>
curl https://<dominio>/api/health     # {"app":"ok","db":"ok",...}
```

## ✅ DoD M0
Página "em breve" no ar com SSL válido · healthcheck verde · backup testado com
restore · nenhum segredo no Git.
