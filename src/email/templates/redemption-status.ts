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
  status: RedemptionEmailStatus;
  /** Nota libre del admin; null oculta el bloque. */
  adminNote: string | null;
  /** Destino del botón (hoy `${FRONTEND_URL}/dashboard/rewards`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

const COPY: Record<
  RedemptionEmailStatus,
  {
    subject: string;
    title: string;
    highlight: string;
    text: string;
    hero: string;
    heroAlt: string;
  }
> = {
  approved: {
    subject: 'Seu resgate foi aprovado',
    title: 'Resgate',
    highlight: 'aprovado!',
    text: 'Sua solicitação foi aprovada e sua recompensa já está em preparação para envio.',
    hero: 'redemption-approved-hero.png',
    heroAlt: 'Kaspersky Partner Quest — Seu resgate foi aprovado.',
  },
  fulfilled: {
    subject: 'Sua recompensa foi entregue',
    title: 'Recompensa',
    highlight: 'entregue!',
    text: 'Sua recompensa foi marcada como entregue. Esperamos que você aproveite!',
    hero: 'redemption-delivered-hero.png',
    heroAlt: 'Kaspersky Partner Quest — Sua recompensa foi entregue.',
  },
  rejected: {
    subject: 'Sua solicitação de resgate não foi aprovada',
    title: 'Resgate',
    highlight: 'não aprovado',
    text: 'Sua solicitação de resgate não foi aprovada. Se tiver dúvidas, fale com a equipe do programa.',
    hero: 'redemption-rejected-hero.png',
    heroAlt:
      'Kaspersky Partner Quest — Sua solicitação de resgate não foi aprovada.',
  },
};

/** Aviso al partner cuando un admin cambia el estado de su canje. */
export function redemptionStatusEmail({
  partnerName,
  rewardTitle,
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

  const body = `<h1 class="h1" style="${STYLES.h1}">
                ${copy.title} <span style="color:${BRAND.teal};">${copy.highlight}</span>
              </h1>
              <p style="${STYLES.p}">${greeting}</p>
              ${renderHighlight(`Recompensa: <strong>${escapeHtml(rewardTitle)}</strong>`)}
              <p style="${STYLES.p}">${copy.text}</p>
              ${note}

              <div style="height:8px;line-height:8px;font-size:1px;">&nbsp;</div>
              ${renderButton(ctaUrl, 'Ver minhas recompensas')}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              ${SIGNOFF}`;

  return {
    subject: `${copy.subject}: ${rewardTitle}`,
    html: renderLayout({
      preheader: `${copy.subject}: ${rewardTitle}.`,
      header: renderHero(assetsBaseUrl, { file: copy.hero, alt: copy.heroAlt }),
      body,
      assetsBaseUrl,
    }),
  };
}
