import {
  BRAND,
  escapeHtml,
  formatDateTimeBR,
  infoRow,
  renderButton,
  renderHero,
  renderLayout,
  SIGNOFF_ADMIN,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface ProgramCompletedAdminEmailParams {
  /** Nombre del partner (o su email) — va en el título. */
  partnerName: string;
  /** "Nome (Empresa)" o el email si no hay nombre. */
  partnerLabel: string;
  stageCount: number;
  completedAt: Date;
  /** Destino del botón (hoy `${FRONTEND_URL}/admin/partners/{id}`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

/** Aviso a los admins: un partner concluyó todas las etapas del programa. */
export function programCompletedAdminEmail({
  partnerName,
  partnerLabel,
  stageCount,
  completedAt,
  ctaUrl,
  assetsBaseUrl,
}: ProgramCompletedAdminEmailParams): EmailTemplate {
  const body = `<h1 class="h1" style="${STYLES.h1}">
                <span style="color:${BRAND.teal};">${escapeHtml(partnerName)}</span> concluiu o Kaspersky Partner Quest
              </h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:22px;font-weight:bold;color:${BRAND.text};">${escapeHtml(partnerLabel)} concluiu com sucesso as ${stageCount} etapas do Kaspersky Partner Quest.</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                ${infoRow(assetsBaseUrl, 'trophy-teal', 'Conquista final:', 'Jornada Kaspersky Completa')}
                ${infoRow(assetsBaseUrl, 'calendar', 'Data de conclusão:', formatDateTimeBR(completedAt))}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding:0 0 6px 0;border-bottom:1px solid ${BRAND.border};font-size:1px;line-height:1px;">&nbsp;</td>
              </tr></table>

              <p style="margin:24px 0 24px 0;font-size:15px;line-height:22px;color:${BRAND.text};">O parceiro completou a jornada inteira, incluindo o desafio final da primeira venda B2B.</p>

              ${renderButton(ctaUrl, 'Ver perfil do parceiro')}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              ${SIGNOFF_ADMIN}`;

  return {
    subject: `Parceiro concluiu o programa: ${partnerLabel}`,
    html: renderLayout({
      preheader: `${partnerLabel} concluiu todas as ${stageCount} etapas do programa.`,
      header: renderHero(assetsBaseUrl, {
        // Sin ilustración propia: reusa la de "etapa concluída" (admins).
        file: 'stage-completed-admin-hero.png',
        alt: 'Kaspersky Partner Quest — Um parceiro concluiu o programa.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
