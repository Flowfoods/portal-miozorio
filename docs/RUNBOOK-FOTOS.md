# RUNBOOK — Fotos do portal (BUG D, 17/08/2026)

## Arquitetura (como É — não mudar sem ler isto)

- **Storage:** volume Docker nomeado **`miozorio-media`** montado em `/app/media`
  (configurado no Dokploy, app `portal-miozorio`). Verificado em 17/08/2026:
  o mount existe e sobrevive a deploy. **Nunca gravar upload fora do volume**
  — filesystem do container é efêmero e some a cada deploy.
- **Layout do volume:**
  - `/app/media/<id>.webp` — master público (2000px, WebP q90) — o único
    conteúdo que a rota `/media/[...path]` serve;
  - `/app/media/orig/` — **originais intactos** (com EXIF/GPS) — NUNCA
    servidos; existem para regerar derivados se a estratégia mudar;
  - `/app/media/priv/` — fotos de referência de cliente + anexos do
    financeiro (LGPD) — só via rotas autenticadas.
- **Fronteira pública:** `src/lib/media-path.ts` (`podeServirPublicamente`)
  — só `.webp` na RAIZ do volume. Subdiretório nenhum sai. Tem teste.

## Fluxo de upload (painel /admin/fotos)

1. Navegador **pré-redimensiona** (≤4000px, JPEG q0.92) quando o arquivo tem
   mais de 4MB e é JPEG/PNG/WebP. HEIC vai como está (o servidor converte).
2. Cada foto sobe **numa request própria** para `POST /api/admin/media`
   (progresso real, retry, falha parcial não derruba o lote).
   ⚠️ Não voltar o upload para server action: o body de 25MB derruba lote
   grande com erro genérico — foi a causa de ZERO fotos entrarem até 08/2026.
3. Servidor valida **magic bytes** (nunca extensão), teto **50MB/foto**,
   guarda o original em `orig/` e gera master WebP 2000px q90
   (`smartSubsample` — preserva transição de cor de pele/batom) + blur
   placeholder + dimensões (colunas `orig_url`, `width`, `height`,
   `blur_data` em `media_assets`).
4. EXIF (incluindo GPS) **não existe** no arquivo público; só no original.

## Entrega no site

- `next/image` com `formats: avif → webp`, `quality 85–90` (nunca o default
  75 — borra maquiagem), `sizes` corretos e `placeholder="blur"`.
- O otimizador do Next cacheia derivados em `.next/cache` (efêmero — ok,
  regenera sob demanda depois de deploy).

## Backup (pendente de agendamento — ver §Gates)

Backup semanal do volume, rodando **no host via Dokploy Schedule** (tipo
Volume Backup, ou schedule com `docker run --rm -v miozorio-media:/dados`):

```bash
tar czf /root/backups/miozorio-media-$(date +%F).tar.gz -C /var/lib/docker/volumes/miozorio-media/_data .
```

- Reter as últimas 8 semanas; alerta se o disco da VPS passar de 80%.
- Restaurar = descompactar de volta no `_data` do volume + `docker restart`.

## Diagnóstico rápido

| Sintoma | Onde olhar |
|---|---|
| "não deu certo: X (tem N MB…)" | > 50MB de verdade — reexportar menor |
| "não consegui ler essa foto" | formato exótico (RAW/TIFF)? magic bytes em `media-shared.ts` |
| Foto some do site após deploy | mount `/app/media` sumiu do Dokploy — conferir `application.one` |
| Upload trava em 4G | request é 1 foto por vez com retry; conferir tamanho pós-otimização no painel |
| Galeria vazia com fotos no painel | `published` = false? banco fora? `/api/health` |

## Histórico

- Até 08/2026: teto 12MB + lote inteiro numa server action (body 25MB) +
  HEIC sem decoder ⇒ **nenhuma foto jamais entrou no ar** (media_assets: 0
  linhas; volume vazio). Não houve perda: nada chegou a ser gravado.
- 17/08/2026 (BUG D): pipeline atual. Original preservado passa a ser
  regra inviolável — derivado se regenera, original não.
