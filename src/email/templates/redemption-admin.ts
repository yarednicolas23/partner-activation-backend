import type { ShippingAddress } from '../../partners/partner-profile.interface';
import {
  BRAND,
  escapeHtml,
  formatDateTimeBR,
  infoRow,
  renderButton,
  renderHero,
  renderHighlight,
  renderLayout,
  SIGNOFF_ADMIN,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface RedemptionAdminEmailParams {
  /**
   * `requested`: el Canal acaba de pedir el resgate (hay que revisarlo).
   * `approved`: un admin lo aprobó — incluye la nota para preparar el envío.
   */
  event: 'requested' | 'approved';
  partnerName: string;
  companyName: string | null;
  partnerEmail: string;
  partnerPhone: string | null;
  rewardTitle: string;
  rewardTypeLabel: string;
  /** null en rewards digitales (no hay envío físico). */
  shippingAddress: ShippingAddress | null;
  /** Nota que el admin escribió al aprobar; solo en `approved`. */
  adminNote: string | null;
  /** Fecha de la solicitud (requested) o de la aprobación (approved). */
  eventAt: Date;
  /** Destino del botón (hoy `${FRONTEND_URL}/admin/rewards`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

export function formatShippingAddress(address: ShippingAddress): string {
  const line1 = [address.street, address.number, address.complement]
    .filter(Boolean)
    .join(', ');
  return `${line1} — ${address.neighborhood}, ${address.city}/${address.state} — CEP ${address.cep}`;
}

const COPY = {
  requested: {
    title: 'Nova solicitação',
    highlight: 'de resgate',
    intro:
      'Um parceiro solicitou uma recompensa no Kaspersky Partner Quest e ela está aguardando aprovação.',
    dateLabel: 'Data da solicitação:',
    action: 'Acesse o Portal Admin para aprovar ou recusar a solicitação.',
    button: 'Revisar solicitação',
    subject: 'Nova solicitação de resgate',
  },
  approved: {
    title: 'Resgate aprovado:',
    highlight: 'preparar envio',
    intro:
      'Uma solicitação de resgate foi aprovada. Confira os dados abaixo para organizar a entrega.',
    dateLabel: 'Data da aprovação:',
    action: 'O parceiro já foi avisado de que o brinde está a caminho.',
    button: 'Ver resgates',
    subject: 'Resgate aprovado — preparar envio',
  },
};

/** Aviso a los admins sobre un resgate (solicitado o aprobado). */
export function redemptionAdminEmail({
  event,
  partnerName,
  companyName,
  partnerEmail,
  partnerPhone,
  rewardTitle,
  rewardTypeLabel,
  shippingAddress,
  adminNote,
  eventAt,
  ctaUrl,
  assetsBaseUrl,
}: RedemptionAdminEmailParams): EmailTemplate {
  const copy = COPY[event];
  const partnerLabel = companyName
    ? `${partnerName} — ${companyName}`
    : partnerName;
  const contact = partnerPhone
    ? `${partnerEmail} · ${partnerPhone}`
    : partnerEmail;

  const address = shippingAddress
    ? infoRow(
        assetsBaseUrl,
        'map-pin',
        'Endereço de entrega:',
        [
          shippingAddress.recipient_name &&
            `A/C ${shippingAddress.recipient_name}`,
          formatShippingAddress(shippingAddress),
        ]
          .filter(Boolean)
          .join(' · '),
      )
    : infoRow(
        assetsBaseUrl,
        'map-pin',
        'Endereço de entrega:',
        'Não se aplica (recompensa digital)',
      );

  const note =
    event === 'approved' && adminNote
      ? `<p style="margin:0 0 8px 0;font-size:15px;line-height:22px;font-weight:bold;color:${BRAND.text};">Nota da aprovação:</p>
              ${renderHighlight(escapeHtml(adminNote).replace(/\n/g, '<br />'))}`
      : '';

  const body = `<h1 class="h1" style="${STYLES.h1}">
                ${copy.title} <span style="color:${BRAND.teal};">${copy.highlight}</span>
              </h1>
              <p style="${STYLES.p}">${copy.intro}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                ${infoRow(assetsBaseUrl, 'user', 'Parceiro:', partnerLabel)}
                ${infoRow(assetsBaseUrl, 'file', 'Contato:', contact)}
                ${infoRow(assetsBaseUrl, 'gift-teal', 'Recompensa:', `${rewardTitle} (${rewardTypeLabel})`)}
                ${address}
                ${infoRow(assetsBaseUrl, 'calendar', copy.dateLabel, formatDateTimeBR(eventAt))}
              </table>
              ${note}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding:0 0 6px 0;border-bottom:1px solid ${BRAND.border};font-size:1px;line-height:1px;">&nbsp;</td>
              </tr></table>

              <p style="margin:24px 0 24px 0;font-size:15px;line-height:22px;color:${BRAND.text};">${copy.action}</p>

              ${renderButton(ctaUrl, copy.button)}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              ${SIGNOFF_ADMIN}`;

  return {
    subject: `${copy.subject}: ${rewardTitle} — ${partnerLabel}`,
    html: renderLayout({
      preheader: `${partnerLabel} · ${rewardTitle}`,
      header: renderHero(assetsBaseUrl, {
        // Pendiente de diseño (ver PENDING_HEROES): sale sin hero.
        file: 'redemption-admin-hero.png',
        alt: 'Kaspersky Partner Quest — Resgate de recompensa.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
