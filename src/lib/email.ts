/**
 * Envio de e-mail transacional via Resend (M13.4). Usa fetch direto na API
 * (sem SDK) para não engordar o bundle standalone nem repetir as dores de
 * file-tracing (bcryptjs/sharp). Segredos só no ambiente (R9):
 *   RESEND_API_KEY  — chave da conta Resend
 *   EMAIL_FROM      — remetente verificado, ex.: "Mi Ozorio <nao-responda@miozorio.com.br>"
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const FROM_FALLBACK = "Mi Ozorio <nao-responda@miozorio.com.br>";

/** Envia um genérico via Resend (usado pelos avisos transacionais). */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada");
  const from = process.env.EMAIL_FROM ?? FROM_FALLBACK;
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend respondeu ${res.status}: ${body}`);
  }
}

/** Aviso pós-troca: "sua senha foi alterada" (segurança — Auth F1.2/2.1). */
export async function sendPasswordChangedEmail(to: string): Promise<void> {
  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;color:#5C4A3D;max-width:480px;margin:0 auto;padding:24px">
      <h1 style="font-size:22px;font-weight:400;color:#8A7361">Sua senha foi alterada</h1>
      <p>A senha do painel da Mi Ozorio acabou de ser alterada e todas as sessões
      anteriores foram encerradas.</p>
      <p style="font-size:13px;color:#8A7361">
        Se foi você, está tudo certo — pode ignorar este aviso. Se <strong>não</strong>
        foi você, redefina a senha imediatamente pelo painel.
      </p>
    </div>`;
  const text =
    "Sua senha do painel da Mi Ozorio foi alterada e as sessões anteriores foram encerradas. Se não foi você, redefina a senha imediatamente.";
  await sendEmail(to, "Sua senha do painel foi alterada — Mi Ozorio", html, text);
}
