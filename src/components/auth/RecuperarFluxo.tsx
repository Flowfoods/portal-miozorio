"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import {
  pedirCodigoAction,
  verificarCodigoAction,
  salvarSenhaAction,
} from "@/app/recuperar-actions";
import type {
  PedirState,
  SalvarState,
  VerificarState,
} from "@/lib/recuperacao-tipos";
import SubmitButton from "@/components/admin/SubmitButton";
import PasswordField from "@/components/auth/PasswordField";

/**
 * Fluxo de recuperação de senha — a MESMA tela para a cliente e para a Mi
 * (B2: modelo único). Três passos: identificar → código → senha nova.
 *
 * O código não chega sozinho: a Mi recebe no WhatsApp dela e repassa. Por isso
 * a tela explica o que está acontecendo, oferece o atalho "Chamar a Mi" e um
 * reenvio com cooldown de 60s — em vez de deixar a pessoa olhando para um campo
 * vazio esperando um SMS que não vem.
 */

export interface RecuperarFluxoProps {
  perfil: "cliente" | "admin";
  /** Link wa.me da Mi com mensagem pronta ("Oi Mi, esqueci minha senha…"). */
  waMi: string;
  /** Para onde ir depois de entrar. */
  destino: string;
  /** Volta para o login do perfil certo. */
  entrarHref: string;
  cadastrarHref?: string;
  minSenha: number;
}

type Passo = "identificar" | "codigo" | "senha";

const COOLDOWN_S = 60;

export default function RecuperarFluxo({
  perfil,
  waMi,
  destino,
  entrarHref,
  cadastrarHref,
  minSenha,
}: RecuperarFluxoProps) {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>("identificar");
  const [identificador, setIdentificador] = useState("");
  const [senhaDigitada, setSenhaDigitada] = useState("");
  const [entrando, setEntrando] = useState(false);

  const [pedir, pedirAction] = useFormState<PedirState, FormData>(
    pedirCodigoAction,
    null,
  );
  const [verificar, verificarAction] = useFormState<VerificarState, FormData>(
    verificarCodigoAction,
    null,
  );
  const [salvar, salvarAction] = useFormState<SalvarState, FormData>(
    salvarSenhaAction,
    null,
  );

  // ── Cooldown do reenvio ────────────────────────────────────────────────────
  const [cooldown, setCooldown] = useState(0);
  const pedidos = useRef(0);
  useEffect(() => {
    if (pedir && "ok" in pedir && pedir.ok) {
      setIdentificador(pedir.identificador);
      setPasso("codigo");
      pedidos.current += 1;
      setCooldown(COOLDOWN_S);
    }
  }, [pedir]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (verificar && "ok" in verificar && verificar.ok) setPasso("senha");
  }, [verificar]);

  // ── Fim do fluxo ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!salvar || !("ok" in salvar) || !salvar.ok) return;
    // A cliente não passa por aqui: quem navega é o redirect da server action.
    if (salvar.perfil !== "admin") return;
    // Painel: a sessão é do NextAuth, então entramos com a senha recém-criada.
    // O import é dinâmico para não arrastar o next-auth para o bundle do site.
    setEntrando(true);
    void (async () => {
      try {
        const { signIn } = await import("next-auth/react");
        const r = await signIn("credentials", {
          email: salvar.email ?? "",
          password: senhaDigitada,
          redirect: false,
        });
        router.replace(r?.ok ? destino : `${entrarHref}?reset=ok`);
      } catch {
        router.replace(`${entrarHref}?reset=ok`);
      } finally {
        router.refresh();
      }
    })();
    // senhaDigitada é lida só no momento do sucesso — não deve reexecutar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvar]);

  const erroPedir = pedir && "error" in pedir ? pedir.error : null;
  const erroVerificar = verificar && "error" in verificar ? verificar : null;
  const erroSalvar = salvar && "error" in salvar ? salvar : null;

  const rotuloIdent =
    perfil === "cliente" ? "Seu WhatsApp" : "Seu e-mail ou WhatsApp";
  const botao =
    "w-full rounded-mi bg-mi-marrom-escuro px-6 py-3.5 font-corpo text-mi-branco transition-colors hover:bg-mi-marrom disabled:opacity-60";

  // ── Reenvio: aparece no passo do código E junto do erro de expiração ───────
  function BotaoReenviar({ rotulo }: { rotulo: string }) {
    return (
      <form action={pedirAction}>
        <input type="hidden" name="identificador" value={identificador} />
        <button
          type="submit"
          disabled={cooldown > 0}
          className="w-full rounded-mi border border-mi-cinza px-4 py-2.5 font-corpo text-sm text-mi-marrom-escuro disabled:text-mi-texto/40"
        >
          {cooldown > 0 ? `Pedir novo código em ${cooldown}s` : rotulo}
        </button>
      </form>
    );
  }

  function ChamarAMi() {
    return (
      <a
        href={waMi}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-mi border border-mi-marrom/40 px-4 py-2.5 text-center font-corpo text-sm text-mi-marrom-escuro"
      >
        Chamar a Mi no WhatsApp
      </a>
    );
  }

  // ── Passo 1 — identificar ─────────────────────────────────────────────────
  if (passo === "identificar") {
    return (
      <div className="space-y-4">
        <p className="font-corpo text-sm text-mi-texto/80">
          Me diz o {perfil === "cliente" ? "WhatsApp" : "e-mail"} do seu
          cadastro. A Mi recebe o código e te manda pelo WhatsApp 💛
        </p>
        <form action={pedirAction} className="space-y-4">
          <label className="block">
            <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
              {rotuloIdent}
            </span>
            <input
              name="identificador"
              type="text"
              inputMode={perfil === "cliente" ? "tel" : "email"}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder={
                perfil === "cliente" ? "(21) 99999-9999" : "voce@exemplo.com"
              }
              className="input-mi"
            />
          </label>
          {erroPedir && (
            <p
              role="alert"
              className="rounded-mi bg-mi-erro/10 px-4 py-3 text-sm text-mi-erro-tinta ring-1 ring-mi-erro/40"
            >
              {erroPedir}
            </p>
          )}
          <SubmitButton pendingLabel="Avisando a Mi…" className={botao}>
            Pedir código para a Mi
          </SubmitButton>
        </form>
        <Rodape entrarHref={entrarHref} cadastrarHref={cadastrarHref} />
      </div>
    );
  }

  // ── Passo 2 — código ───────────────────────────────────────────────────────
  if (passo === "codigo") {
    return (
      <div className="space-y-4">
        {/*
          Duas frases, as duas mostradas SEMPRE (existindo ou não a conta —
          então não vaza nada): a instrução, que é o que a cliente precisa
          entender (o código não chega sozinho, quem manda é a Mi), e a
          mensagem neutra que o próprio motor devolve.
        */}
        <div className="rounded-mi bg-mi-bege/60 px-4 py-3 font-corpo text-sm text-mi-texto">
          <p>
            Pedimos à Mi que te envie o código pelo WhatsApp. Assim que receber,
            digite aqui 💛
          </p>
          {pedir && "ok" in pedir && (
            <p className="mt-1 text-mi-texto/80">{pedir.aviso}</p>
          )}
        </div>
        <form action={verificarAction} className="space-y-4">
          <input type="hidden" name="identificador" value={identificador} />
          <label className="block">
            <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
              Código de 6 números
            </span>
            <input
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="000000"
              className="input-mi text-center text-2xl tracking-[0.5em]"
            />
          </label>
          {erroVerificar && (
            <div
              role="alert"
              className="space-y-2 rounded-mi bg-mi-erro/10 px-4 py-3 text-sm text-mi-erro-tinta ring-1 ring-mi-erro/40"
            >
              <p>{erroVerificar.error}</p>
              {erroVerificar.pedirNovo && (
                <BotaoReenviar rotulo="Pedir novo código" />
              )}
            </div>
          )}
          <SubmitButton pendingLabel="Conferindo…" className={botao}>
            Confirmar código
          </SubmitButton>
        </form>
        <ChamarAMi />
        <BotaoReenviar rotulo="Não recebeu? Pedir novo código" />
        <Rodape entrarHref={entrarHref} cadastrarHref={cadastrarHref} />
      </div>
    );
  }

  // ── Passo 3 — senha nova ───────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="rounded-mi bg-mi-sucesso/10 px-4 py-3 font-corpo text-sm text-mi-sucesso-tinta">
        Código confirmado 💛 Agora crie sua nova senha — sem pressa, o código
        fica guardado até você salvar.
      </p>
      <form action={salvarAction} className="space-y-4">
        <input type="hidden" name="destino" value={destino} />
        <label className="block">
          <span className="mb-1 block font-corpo text-sm text-mi-texto/80">
            Nova senha
          </span>
          <PasswordField
            name="senha"
            required
            minLength={minSenha}
            autoComplete="new-password"
            showStrength
            onChange={(e) => setSenhaDigitada(e.target.value)}
          />
          <span className="mt-1 block font-corpo text-xs text-mi-texto/80">
            {perfil === "cliente"
              ? `Pelo menos ${minSenha} caracteres, diferente do seu telefone.`
              : `Pelo menos ${minSenha} caracteres. Misture letras, números e símbolos.`}
          </span>
        </label>
        {erroSalvar && (
          <div
            role="alert"
            className="space-y-2 rounded-mi bg-mi-erro/10 px-4 py-3 text-sm text-mi-erro-tinta ring-1 ring-mi-erro/40"
          >
            <p>{erroSalvar.error}</p>
            {erroSalvar.pedirNovo && (
              // B3 — o botão de pedir novo código aparece AQUI mesmo, sem
              // obrigar a pessoa a voltar de tela e recomeçar.
              <BotaoReenviar rotulo="Pedir novo código" />
            )}
          </div>
        )}
        <SubmitButton
          pendingLabel={entrando ? "Entrando…" : "Salvando…"}
          className={botao}
        >
          Salvar e entrar
        </SubmitButton>
      </form>
      <Rodape entrarHref={entrarHref} cadastrarHref={cadastrarHref} />
    </div>
  );
}

function Rodape({
  entrarHref,
  cadastrarHref,
}: {
  entrarHref: string;
  cadastrarHref?: string;
}) {
  return (
    <div className="space-y-1 pt-2 text-center font-corpo text-sm text-mi-texto/80">
      <p>
        Lembrou a senha?{" "}
        <Link
          href={entrarHref}
          className="text-mi-marrom-700 underline underline-offset-4"
        >
          Entrar
        </Link>
      </p>
      {cadastrarHref && (
        <p>
          Ainda não tem conta?{" "}
          <Link
            href={cadastrarHref}
            className="text-mi-marrom-700 underline underline-offset-4"
          >
            Cadastrar
          </Link>
        </p>
      )}
    </div>
  );
}
