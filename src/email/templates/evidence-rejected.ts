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

export interface EvidenceRejectedEmailParams {
  partnerName: string | null;
  missionTitle: string;
  /** Comentario libre del admin; null oculta el bloque. */
  reviewNote: string | null;
  /** Destino del botón (hoy `${FRONTEND_URL}/dashboard`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

/** Aviso al partner: su comprovação no fue aprobada y puede reenviarla. */
export function evidenceRejectedEmail({
  partnerName,
  missionTitle,
  reviewNote,
  ctaUrl,
  assetsBaseUrl,
}: EvidenceRejectedEmailParams): EmailTemplate {
  const greeting = partnerName ? `Olá, ${escapeHtml(partnerName)}!` : 'Olá!';
  const note = reviewNote
    ? `<p style="margin:0 0 8px 0;font-size:15px;line-height:22px;font-weight:bold;color:${BRAND.text};">Comentário da equipe Kaspersky:</p>
              ${renderHighlight(escapeHtml(reviewNote).replace(/\n/g, '<br />'))}`
    : '';

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Sua comprovação <span style="color:${BRAND.teal};">precisa de ajustes</span>
              </h1>
              <p style="${STYLES.p}">${greeting}</p>
              <p style="${STYLES.p}">A comprovação enviada para a missão <strong>${escapeHtml(missionTitle)}</strong> não foi aprovada.</p>
              ${note}
              <p style="${STYLES.lead}">Revise as orientações da missão e envie uma nova comprovação pela plataforma.</p>

              ${renderButton(ctaUrl, 'Enviar nova comprovação')}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              ${SIGNOFF}`;

  return {
    subject: 'Comprovação não aprovada — Kaspersky Partner Quest',
    html: renderLayout({
      preheader: `Sua comprovação para "${missionTitle}" não foi aprovada. Envie uma nova pela plataforma.`,
      header: renderHero(assetsBaseUrl, {
        file: 'evidence-rejected-hero.png',
        alt: 'Kaspersky Partner Quest — Sua comprovação precisa de ajustes.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
