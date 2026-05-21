function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface PasswordRecoveryEmailTemplateParams {
  userName: string;
  resetUrl: string;
}

export function buildPasswordRecoveryEmailTemplate({
  userName,
  resetUrl,
}: PasswordRecoveryEmailTemplateParams) {
  const safeUserName = escapeHtml(userName);
  const safeResetUrl = escapeHtml(resetUrl);

  const text = `Olá, ${userName}!\n\nRecebemos uma solicitação para redefinir sua senha no Fluxora.\n\nPara criar uma nova senha, acesse o link abaixo:\n${resetUrl}\n\nEste link expira em 1 hora.\n\nSe você não solicitou esta redefinição, ignore esta mensagem.\n\nFluxora`;

  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Redefina sua senha no Fluxora</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
              <tr>
                <td style="padding:32px 32px 24px;background-color:#111827;color:#ffffff;">
                  <div style="font-size:14px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.72;margin-bottom:12px;">Fluxora</div>
                  <h1 style="margin:0;font-size:28px;line-height:1.25;font-weight:700;">Redefina sua senha</h1>
                  <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#d4d4d8;">
                    Recebemos uma solicitação para atualizar o acesso da sua conta.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Olá, <strong>${safeUserName}</strong>.</p>
                  <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                    Para criar uma nova senha, clique no botão abaixo.
                  </p>
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                    <tr>
                      <td align="center" style="border-radius:10px;background-color:#111827;">
                        <a href="${safeResetUrl}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Redefinir senha</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#52525b;">
                    Este link expira em <strong>1 hora</strong>.
                  </p>
                  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#52525b;word-break:break-word;">
                    Se o botão não funcionar, copie e cole este link no navegador:<br />
                    <a href="${safeResetUrl}" style="color:#111827;">${safeResetUrl}</a>
                  </p>
                  <div style="border-top:1px solid #e4e4e7;padding-top:24px;">
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#52525b;">
                      Se você não solicitou esta redefinição, ignore esta mensagem.
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#52525b;">
                      Fluxora, controle financeiro operacional para pequenas empresas de serviço.
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

  return { text, html };
}
