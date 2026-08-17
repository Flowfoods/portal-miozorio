import Link from "next/link";
import { DateTime } from "luxon";
import { formatBRL, waLinkMsg } from "@/lib/format";
import { getCrmConfig, nomesSegmentos } from "@/lib/crm-config";
import {
  clientesSumidas,
  leadsNuncaEntraram,
  visitouNaoMarcou,
  engajadasIndicacao,
  explorarClientes,
} from "@/lib/crm-listas";

export const dynamic = "force-dynamic";

/**
 * CRM 2.0 F3 — listas acionáveis: cada número vira pessoas, cada pessoa tem
 * botão de ação (WhatsApp com rascunho no tom da Mi — ela revisa antes de
 * enviar). Limiares vêm da régua (/admin/crm/config).
 */

const TIPOS = [
  { id: "sumidas", label: "Sumidas" },
  { id: "leads", label: "Nunca entraram" },
  { id: "visitou", label: "Visitou e não marcou" },
  { id: "indicacao", label: "Engajadas na indicação" },
  { id: "explorar", label: "Explorar" },
] as const;

type Tipo = (typeof TIPOS)[number]["id"];

// Rascunhos de mensagem (a Mi edita no WhatsApp antes de enviar — R20).
// <!-- APROVAR COM A MI: copy das mensagens de reativação -->
const MSG = {
  sumidas: (nome: string) =>
    `Oi ${nome.split(" ")[0]}! Que saudade de você por aqui 💛 Já pensou em marcar um horário pra gente se ver de novo?`,
  leads: (nome: string) =>
    `Oi ${nome.split(" ")[0]}! Aqui é a Mi 💛 Vi seu cadastro por aqui — quer conhecer o estúdio ou tirar alguma dúvida?`,
  visitou: (nome: string) =>
    `Oi ${nome.split(" ")[0]}! Vi que você deu uma olhadinha nos horários 💛 Posso te ajudar a escolher o melhor?`,
  indicacao: (nome: string) =>
    `Oi ${nome.split(" ")[0]}! Obrigada por indicar o estúdio 💛 Suas amigas vão amar!`,
} as const;

function WaBtn({ phone, msg }: { phone: string; msg: string }) {
  return (
    <a
      href={waLinkMsg(phone, msg)}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-mi bg-mi-marrom-escuro px-3 py-1.5 text-xs text-white"
    >
      WhatsApp
    </a>
  );
}

function NomeLink({ id, nome }: { id: string; nome: string }) {
  return (
    <Link
      href={`/admin/clientes/${id}`}
      className="font-medium text-mi-marrom-escuro underline underline-offset-4"
    >
      {nome}
    </Link>
  );
}

const fmtData = (d: Date) =>
  DateTime.fromJSDate(d).setZone("America/Sao_Paulo").toFormat("dd/LL");

export default async function CrmListasPage({
  searchParams,
}: {
  searchParams: {
    tipo?: string;
    seg?: string;
    dias?: string;
    comp?: string;
    origem?: string;
  };
}) {
  const cfg = await getCrmConfig();
  const tipo: Tipo = (TIPOS.some((t) => t.id === searchParams.tipo)
    ? searchParams.tipo
    : "sumidas") as Tipo;

  const csvParams = new URLSearchParams({ tipo });
  for (const k of ["seg", "dias", "comp", "origem"] as const) {
    if (searchParams[k]) csvParams.set(k, searchParams[k]!);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Listas de ação</h1>
        <Link href="/admin/crm" className="text-sm text-mi-marrom-escuro hover:underline">
          ← CRM
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/crm/listas?tipo=${t.id}`}
            className={`rounded-full px-4 py-2 text-sm ${
              tipo === t.id
                ? "bg-mi-marrom-escuro text-white"
                : "border border-mi-cinza bg-mi-branco"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <a
          href={`/admin/crm/listas/csv?${csvParams.toString()}`}
          className="ml-auto rounded-mi border border-mi-cinza px-4 py-2 text-sm"
        >
          Baixar CSV
        </a>
      </div>

      {tipo === "sumidas" && <ListaSumidas dias={cfg.limiares.sumidaDias} />}
      {tipo === "leads" && <ListaLeads dias={cfg.limiares.leadFriaDias} />}
      {tipo === "visitou" && (
        <ListaVisitou destaque={cfg.limiares.abandonoTentativas} />
      )}
      {tipo === "indicacao" && <ListaIndicacao />}
      {tipo === "explorar" && (
        <Explorar cfgSegmentos={nomesSegmentos(cfg)} sp={searchParams} />
      )}
    </>
  );
}

async function ListaSumidas({ dias }: { dias: number }) {
  const rows = await clientesSumidas(dias);
  return (
    <section>
      <p className="mb-4 text-sm text-mi-texto/80">
        Mais de <strong>{dias} dias</strong> sem atendimento (ajuste em{" "}
        <Link href="/admin/crm/config" className="underline">
          Configurações do CRM
        </Link>
        ) — as mais valiosas primeiro.
      </p>
      <Tabela
        vazio="Ninguém sumida — sua base está em dia 💛"
        cab={["Cliente", "Sem vir há", "Já investiu", "Segmento", ""]}
        linhas={rows.map((r) => [
          <NomeLink key="n" id={r.id} nome={r.name} />,
          `${r.diasSemVir} dias`,
          formatBRL(r.totalGastoCents),
          r.rfvSegmento ?? "—",
          <WaBtn key="w" phone={r.phoneE164} msg={MSG.sumidas(r.name)} />,
        ])}
      />
    </section>
  );
}

async function ListaLeads({ dias }: { dias: number }) {
  const rows = await leadsNuncaEntraram(dias);
  return (
    <section>
      <p className="mb-4 text-sm text-mi-texto/80">
        Cadastradas há mais de <strong>{dias} dias</strong> que nunca acessaram
        o portal nem tiveram atendimento.
      </p>
      <Tabela
        vazio="Nenhum primeiro contato esquecido por aqui."
        cab={["Cliente", "Cadastrada há", "Origem", ""]}
        linhas={rows.map((r) => [
          <NomeLink key="n" id={r.id} nome={r.name} />,
          `${r.criadaHaDias} dias`,
          r.funilEtapa ? `funil (${r.funilEtapa})` : (r.origem ?? "—"),
          <WaBtn key="w" phone={r.phoneE164} msg={MSG.leads(r.name)} />,
        ])}
      />
    </section>
  );
}

async function ListaVisitou({ destaque }: { destaque: number }) {
  const rows = await visitouNaoMarcou(30);
  return (
    <section>
      <p className="mb-4 text-sm text-mi-texto/80">
        Entraram no agendamento nos últimos 30 dias e não marcaram. Em
        vermelho: {destaque}+ tentativas.
      </p>
      <Tabela
        vazio="Ninguém pendurada no agendamento — tudo fluindo."
        cab={["Cliente", "Tentativas", "Última vez", ""]}
        linhas={rows.map((r) => [
          <NomeLink key="n" id={r.id} nome={r.name} />,
          r.tentativas >= destaque ? (
            <span key="t" className="font-bold text-mi-erro-tinta">
              {r.tentativas}
            </span>
          ) : (
            String(r.tentativas)
          ),
          fmtData(r.ultimaVez),
          <WaBtn key="w" phone={r.phoneE164} msg={MSG.visitou(r.name)} />,
        ])}
      />
    </section>
  );
}

async function ListaIndicacao() {
  const rows = await engajadasIndicacao();
  return (
    <section>
      <p className="mb-4 text-sm text-mi-texto/80">
        Quem mais compartilha o link de indicação — e quantas amigas
        indicadas já foram atendidas.
      </p>
      <Tabela
        vazio="Nenhum compartilhamento registrado ainda."
        cab={["Cliente", "Compartilhou", "Indicadas atendidas", "Conversão", ""]}
        linhas={rows.map((r) => [
          <NomeLink key="n" id={r.id} nome={r.name} />,
          `${r.compartilhamentos}×`,
          String(r.indicadasAtendidas),
          r.compartilhamentos > 0
            ? `${Math.round((r.indicadasAtendidas / r.compartilhamentos) * 100)}%`
            : "—",
          <WaBtn key="w" phone={r.phoneE164} msg={MSG.indicacao(r.name)} />,
        ])}
      />
    </section>
  );
}

async function Explorar({
  cfgSegmentos,
  sp,
}: {
  cfgSegmentos: string[];
  sp: { seg?: string; dias?: string; comp?: string; origem?: string };
}) {
  const filtros = {
    segmento: sp.seg || undefined,
    semContatoDias: sp.dias ? Number(sp.dias) : undefined,
    compartilhou:
      sp.comp === "sim" ? true : sp.comp === "nao" ? false : undefined,
    origem: sp.origem || undefined,
  };
  const rows = await explorarClientes(filtros);
  return (
    <section>
      <form
        action="/admin/crm/listas"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-mi bg-mi-branco p-4 shadow-suave"
      >
        <input type="hidden" name="tipo" value="explorar" />
        <label className="text-xs">
          Segmento
          <select name="seg" defaultValue={sp.seg ?? ""} className="input-mi mt-1 !py-2">
            <option value="">todos</option>
            {cfgSegmentos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Sem vir há mais de (dias)
          <input
            name="dias"
            type="number"
            min={0}
            defaultValue={sp.dias ?? ""}
            className="input-mi mt-1 !w-28 !py-2"
          />
        </label>
        <label className="text-xs">
          Compartilhou indicação
          <select name="comp" defaultValue={sp.comp ?? ""} className="input-mi mt-1 !py-2">
            <option value="">tanto faz</option>
            <option value="sim">sim</option>
            <option value="nao">não</option>
          </select>
        </label>
        <label className="text-xs">
          Origem
          <input
            name="origem"
            defaultValue={sp.origem ?? ""}
            placeholder="instagram…"
            className="input-mi mt-1 !w-32 !py-2"
          />
        </label>
        <button className="rounded-mi bg-mi-marrom-escuro px-4 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>
      <Tabela
        vazio="Nenhuma cliente com esses filtros."
        cab={[
          "Cliente",
          "Segmento",
          "Sem vir há",
          "Visitas 30d",
          "Tentativas 30d",
          "Indicações",
          "Já investiu",
        ]}
        linhas={rows.map((r) => [
          <NomeLink key="n" id={r.id} nome={r.name} />,
          r.rfvSegmento ?? "—",
          r.diasSemVir != null ? `${r.diasSemVir} dias` : "nunca veio",
          String(r.visitas30d),
          String(r.tentativas30d),
          String(r.indicacoes),
          formatBRL(r.totalGastoCents),
        ])}
      />
    </section>
  );
}

function Tabela({
  cab,
  linhas,
  vazio,
}: {
  cab: string[];
  linhas: React.ReactNode[][];
  vazio: string;
}) {
  return (
    <div className="overflow-x-auto rounded-mi bg-mi-branco shadow-suave">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mi-cinza text-left text-xs text-mi-texto/80">
            {cab.map((c, i) => (
              <th key={i} className="px-4 py-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td
                colSpan={cab.length}
                className="px-4 py-8 text-center text-mi-texto/80"
              >
                {vazio}
              </td>
            </tr>
          )}
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-mi-cinza/60">
              {l.map((c, j) => (
                <td key={j} className="px-4 py-3">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
