import {
  BRAND,
  escapeHtml,
  renderButton,
  renderHero,
  renderLayout,
  SIGNOFF,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface EvidenceApprovedEmailParams {
  /** Nombre del partner para el saludo; null usa un saludo genérico. */
  partnerName: string | null;
  /** Título de la tarea (misión) cuya evidencia fue aprobada. */
  missionTitle: string;
  /** Destino del botón (hoy `${FRONTEND_URL}/dashboard`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

/**
 * Aviso al partner de que una comprovação fue aprobada. No se envía cuando la
 * aprobación completa la etapa: ahí llega "etapa concluída" (o "jornada
 * completa") en su lugar.
 */
export function evidenceApprovedEmail({
  partnerName,
  missionTitle,
  ctaUrl,
  assetsBaseUrl,
}: EvidenceApprovedEmailParams): EmailTemplate {
  const greeting = partnerName ? `Olá, ${escapeHtml(partnerName)}!` : 'Olá!';

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Comprovação <span style="color:${BRAND.teal};">aprovada!</span>
              </h1>
              <p style="${STYLES.p}">${greeting}</p>
              <p style="${STYLES.p}">Sua comprovação para a missão <strong>${escapeHtml(missionTitle)}</strong> foi validada pela equipe Kaspersky e a missão está concluída.</p>
              <p style="${STYLES.lead}">Continue avançando: as próximas missões da sua etapa estão esperando por você.</p>

              ${renderButton(ctaUrl, 'Acessar minha jornada')}

              <div style="height:40px;line-height:40px;font-size:1px;">&nbsp;</div>
              ${SIGNOFF}`;

  return {
    subject: 'Sua comprovação foi aprovada — Kaspersky Partner Quest',
    html: renderLayout({
      preheader: `A missão ${missionTitle} foi aprovada. Continue sua jornada!`,
      header: renderHero(assetsBaseUrl, {
        file: 'evidence-approved-hero.png',
        alt: 'Kaspersky Partner Quest — Sua comprovação foi aprovada.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
