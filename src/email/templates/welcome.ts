import { BRAND, escapeHtml, renderLayout } from './layout';
import { EmailTemplate } from './types';

export interface WelcomeEmailParams {
  /** Destino del botón (hoy `${FRONTEND_URL}/login`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

/**
 * Email de bienvenida post pre-registro. El hero (`welcome-hero.png`) es una
 * sola imagen que ya incluye el logo Partner Quest y el titular — por eso el
 * `alt` repite el titular: si el cliente bloquea imágenes, el mensaje se
 * sigue leyendo.
 */
export function welcomeEmail({
  ctaUrl,
  assetsBaseUrl,
}: WelcomeEmailParams): EmailTemplate {
  const href = escapeHtml(ctaUrl);
  const p = `margin:0 0 20px 0;font-size:16px;line-height:24px;color:${BRAND.text};`;

  const header = `<tr>
            <td style="background-color:#EEF3F2;">
              <img src="${assetsBaseUrl}/welcome-hero.png" width="600" height="252" alt="Kaspersky Partner Quest — Sua jornada no Kaspersky Partner Quest começa agora." style="display:block;width:100%;max-width:600px;height:auto;border:0;font-family:${BRAND.bodyFont};font-size:18px;color:${BRAND.text};" />
            </td>
          </tr>`;

  const body = `<h1 class="h1" style="margin:0 0 12px 0;font-family:${BRAND.headingFont};font-size:21px;line-height:28px;font-weight:900;letter-spacing:0.5px;text-transform:uppercase;color:${BRAND.text};">
                Bem-vindo ao <span style="color:${BRAND.teal};">Kaspersky Partner Quest!</span>
              </h1>
              <p style="${p}">Você foi convidado a participar do Kaspersky Partner Quest, o programa criado para reconhecer sua evolução, valorizar suas conquistas e celebrar cada passo da sua trajetória como parceiro Kaspersky.</p>
              <p style="${p}">Ao longo da sua jornada, você vai cumprir 5 etapas, cada uma com missões que ajudam você a avançar, desenvolver novas habilidades, gerar oportunidades e conquistar reconhecimentos.</p>
              <p style="margin:0 0 28px 0;font-size:18px;line-height:26px;font-weight:bold;color:${BRAND.text};">Pronto para começar? Acesse a plataforma abaixo e dê o primeiro passo.</p>

              <table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:380px;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:${BRAND.teal};">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:52px;v-text-anchor:middle;width:380px;" arcsize="20%" stroke="f" fillcolor="${BRAND.teal}">
                      <center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:18px;">Acessar o Kaspersky Partner Quest</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${href}" target="_blank" style="display:block;padding:15px 24px;font-family:${BRAND.bodyFont};font-size:18px;line-height:22px;color:#FFFFFF;text-decoration:none;border-radius:10px;">Acessar o Kaspersky Partner Quest</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <p style="margin:14px 0 36px 0;font-size:13px;line-height:18px;font-style:italic;color:${BRAND.muted};">Não é necessário criar uma senha. Você recebe um link de acesso exclusivo por e-mail.</p>
              <p style="margin:0;font-size:16px;line-height:22px;color:${BRAND.text};">Boa jornada!<br />Equipe Kaspersky Partner Quest</p>`;

  return {
    subject: 'Bem-vindo ao Kaspersky Partner Quest',
    html: renderLayout({
      preheader:
        'Sua jornada no Kaspersky Partner Quest começa agora. Acesse a plataforma e dê o primeiro passo.',
      header,
      body,
      assetsBaseUrl,
    }),
  };
}
