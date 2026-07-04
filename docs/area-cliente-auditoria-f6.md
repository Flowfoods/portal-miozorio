# F6 — Auditoria de segurança da Área da Cliente

> Auditoria final (sec-audit-fraud-guard) das superfícies novas das F1–F5.
> 2026-07-04. Escopo: código (a VPS/infra compartilhada não foi sondada por
> SSH — fora do escopo desta entrega). Score: **95/100** (1 achado LOW, corrigido).

## Camadas auditadas

### 1. Segredos — ✅ OK
- Nenhum segredo hardcoded nas superfícies novas (grep de api_key/secret/token/password).
- `.env` não rastreado nem no histórico do git; `.gitignore` cobre `.env*` e `/.claude/*.py` (token Dokploy).

### 2. Injeção SQL / input — ✅ OK
- `momentos.ts`, `retencao.ts`, `testimonials.ts`: 100% Prisma parametrizado, zero string interpolada em query.
- Uploads e forms validados por Zod / checagem explícita; `createBookingBody.source` é enum fechado (`web | area_cliente`) — sem injeção pela origem.

### 3. Autorização / IDOR — ✅ OK
- Toda leitura/mutação da cliente filtra por `customerId` **da sessão** (`getClienteSession`), nunca por parâmetro do request. `editarMomento`/`excluirMomento`/vínculo de booking incluem `customerId` no `where`.
- Moderação (`aprovar/rejeitar/toggle foto/destaque/arquivar`) passa por `requireAdmin()`.
- Rota `/momentos/foto/[id]`: **gate por status no banco** — pública só se `aprovado + foto aprovada + consent`; senão só a dona (sessão) ou a Mi (admin); senão 404. Cliente só vê a própria foto pendente (sem IDOR por id).

### 4. Integridade do ledger — ✅ OK (1 achado LOW corrigido)
- `club_transactions.dedup_key @unique` garante crédito idempotente no banco (service/referral/depoimento/foto/reagendamento).
- **Achado LOW (corrigido):** o dedup de foto era `foto:<photoId>`; ao editar trocando fotos por novas (ids novos) e re-aprovar, creditaria de novo. Exposição real baixa (só com pontos de foto ligados + Mi re-aprovando manualmente), mas fechado: **crédito só na 1ª aprovação** (`moderadoEm === null`), blindando depoimento e foto contra re-crédito. Belt-and-suspenders com o dedup único.
- Resgate: `$transaction` Serializable recalcula saldo (sem saldo negativo / double-spend) — inalterado.

### 5. Uploads — ✅ OK
- Allowlist de mime + **magic bytes no servidor** (JPEG/PNG/WebP) + 8MB/foto + até 4 fotos; sharp reprocessa (WebP 1600px, EXIF/geo removidos) → **store PRIVADO** (`priv/`), nunca em `/media` público.
- Rate-limit: máx. 3 momentos pendentes por cliente.

### 6. LGPD — ✅ OK
- Consentimento registrado com **timestamp** (`consentimentoPublicoAt`) no envio; obrigatório (checkbox) para publicar.
- **Exclusão** pela cliente: `delete` (cascade nas fotos) + remoção dos arquivos privados + `revalidatePath("/")` → sai do site imediatamente.
- Edição volta para `pendente` e despublica até re-aprovação.

## Não auditado (fora do escopo desta entrega)
- VPS/portas/firewall/permissões via SSH (infra compartilhada — não sondar sem janela).
  Referências de prod já conhecidas: banco interno não exposto; headers HSTS/CSP/XFO/nosniff ativos (M8.2).
- Badge de pendências no sidebar admin (ADMIN_NAV estático) — melhoria de UX, não de segurança; deferida.

## Veredito
Nenhuma vulnerabilidade crítica ou alta. O único achado (LOW, re-crédito de foto) foi corrigido nesta fase. Plano da Área da Cliente (F0–F6) concluído.
