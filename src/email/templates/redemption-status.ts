import {
  BRAND,
  escapeHtml,
  renderButton,
  renderHero,
  renderHighlight,
  renderLayout,
  SIGNOFF,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export type RedemptionEmailStatus = 'approved' | 'rejected' | 'fulfilled';

export interface RedemptionStatusEmailParams {
  partnerName: string | null;
  rewardTitle: string;
  /**
   * Foto de la recompensa (URL absoluta); null oculta la columna de la foto y
   * las tarjetas ocupan todo el ancho.
   */
  rewardImageUrl: string | null;
  status: RedemptionEmailStatus;
  /** Nota libre del admin; null oculta el bloque. */
  adminNote: string | null;
  /** Destino del botón (hoy `${FRONTEND_URL}/dashboard/rewards`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

// Un único diseño para los tres estados (solo cambian el asunto y el valor de
// "Status"). "A caminho" no va acá: el envío se informa con "Entregue".
const COPY: Record<RedemptionEmailStatus, { subject: string; label: string }> =
  {
    approved: { subject: 'Seu resgate foi aprovado', label: 'Aprovada' },
    rejected: {
      subject: 'Sua solicitação de resgate não foi aprovada',
      label: 'Rejeitada',
    },
    fulfilled: { subject: 'Sua recompensa foi entregue', label: 'Entregue' },
  };

/** Tarjeta gris "etiqueta + valor" (Recompensa / Status). */
function infoCard(label: string, value: string, marginBottom: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${marginBottom}px 0;">
                      <tr>
                        <td style="padding:22px 24px;background-color:#EEF2F5;border-radius:12px;font-family:${BRAND.bodyFont};font-size:15px;line-height:21px;color:${BRAND.text};">
                          ${label}<br /><strong style="font-size:18px;line-height:26px;">${escapeHtml(value)}</strong>
                        </td>
                      </tr>
                    </table>`;
}

/** Aviso al partner cuando un admin cambia el estado de su canje. */
export function redemptionStatusEmail({
  partnerName,
  rewardTitle,
  rewardImageUrl,
  status,
  adminNote,
  ctaUrl,
  assetsBaseUrl,
}: RedemptionStatusEmailParams): EmailTemplate {
  const copy = COPY[status];
  const greeting = partnerName ? `Olá, ${escapeHtml(partnerName)}!` : 'Olá!';
  const note = adminNote
    ? `<p style="margin:0 0 8px 0;font-size:15px;line-height:22px;font-weight:bold;color:${BRAND.text};">Comentário da equipe Kaspersky:</p>
              ${renderHighlight(escapeHtml(adminNote).replace(/\n/g, '<br />'))}`
    : '';

  const cards = `${infoCard('Recompensa:', rewardTitle, 10)}
                    ${infoCard('Status:', copy.label, 0)}`;
  // Foto a la izquierda y tarjetas a la derecha; en mobile se apilan (.stack).
  const details = rewardImageUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td class="stack" width="180" style="width:180px;padding:0 10px 0 0;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding:16px;background-color:#F5F5F5;border-radius:12px;">
                          <img src="${escapeHtml(rewardImageUrl)}" width="148" alt="${escapeHtml(rewardTitle)}" style="display:block;width:100%;max-width:148px;height:auto;border:0;font-family:${BRAND.bodyFont};font-size:14px;color:${BRAND.muted};" />
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td class="stack" style="vertical-align:top;">
                    ${cards}
                  </td>
                </tr>
              </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr><td>
                    ${cards}
                </td></tr>
              </table>`;

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Atualização <span style="color:${BRAND.teal};">da sua recompensa</span>
              </h1>
              <p style="margin:0 0 28px 0;font-size:16px;line-height:24px;color:${BRAND.text};"><strong>${greeting}</strong><br />Sua solicitação de recompensa teve uma atualização de status:</p>
              ${details}
              ${note}
              <p style="${STYLES.p}">Acompanhe os detalhes do seu pedido direto na plataforma.</p>
              ${renderButton(ctaUrl, 'Acessar o Kaspersky Partner Quest')}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              ${SIGNOFF}`;

  return {
    subject: `${copy.subject}: ${rewardTitle}`,
    html: renderLayout({
      preheader: `Sua solicitação de recompensa teve uma atualização: ${rewardTitle} — ${copy.label}.`,
      header: renderHero(assetsBaseUrl, {
        // Los tres heroes redemption-*-hero.png son la misma imagen ("Sua
        // solicitação de recompensa teve uma atualização").
        file: 'redemption-approved-hero.png',
        alt: 'Kaspersky Partner Quest — Sua solicitação de recompensa teve uma atualização.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
