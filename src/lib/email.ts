/**
 * Envio de e-mail transacional via Resend (M13.4). Usa fetch direto na API
 * (sem SDK) para não engordar o bundle standalone nem repetir as dores de
 * file-tracing (bcryptjs/sharp). Segredos só no ambiente (R9):
 *   RESEND_API_KEY  — chave da conta Resend
 *   EMAIL_FROM      — remetente verificado, ex.: "Mi Ozorio <nao-responda@miozorio.com.br>"
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const FROM_FALLBACK = "Mi Ozorio <nao-responda@miozorio.com.br>";

/** Envia o e-mail de redefinição de senha. Lança se o provedor falhar. */
export async function sendPasswordResetEmail(
  to: string,
  link: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada");
  const from = process.env.EMAIL_FROM ?? FROM_FALLBACK;

  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;color:#5C4A3D;max-width:480px;margin:0 auto;padding:24px">
      <h1 style="font-size:22px;font-weight:400;color:#8A7361">Redefinir sua senha</h1>
      <p>Recebemos um pedido para redefinir a senha do painel da Mi Ozorio.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#8A7361;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block">
          Criar nova senha
        </a>
      </p>
      <p style="font-size:13px;color:#8A7361">
        O link vale por 1 hora. Se não foi você que pediu, pode ignorar este e-mail —
        sua senha continua a mesma.
      </p>
    </div>`;
  const text = `Redefinir sua senha do painel da Mi Ozorio.\n\nAbra: ${link}\n\nO link vale por 1 hora. Se não foi você que pediu, ignore este e-mail.`;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Redefinir a senha do painel — Mi Ozorio",
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend respondeu ${res.status}: ${body}`);
  }
}
