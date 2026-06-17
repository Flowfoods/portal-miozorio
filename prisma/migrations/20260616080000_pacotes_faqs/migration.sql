-- Vitrine editável de noiva/debutante (Onda B). Aditiva (R11): só CREATE TABLE.
-- Sem linhas para uma categoria, a página usa o fallback do código.

CREATE TABLE "pacotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoria" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" TEXT NOT NULL,
    "parcela" TEXT,
    "itens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rodape" TEXT,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pacotes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pacotes_categoria_ativo_idx" ON "pacotes"("categoria", "ativo");

CREATE TABLE "faqs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoria" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "faqs_categoria_ativo_idx" ON "faqs"("categoria", "ativo");
