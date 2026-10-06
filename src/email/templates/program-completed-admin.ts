import {
  BRAND,
  escapeHtml,
  formatDateTimeBR,
  infoRow,
  renderButton,
  renderHero,
  renderLayout,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface ProgramCompletedAdminEmailParams {
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
  partnerLabel,
  stageCount,
  completedAt,
  ctaUrl,
  assetsBaseUrl,
}: ProgramCompletedAdminEmailParams): EmailTemplate {
  const body = `<h1 class="h1" style="${STYLES.h1}">
                Programa <span style="color:${BRAND.teal};">concluído</span>
              </h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:22px;font-weight:bold;color:${BRAND.text};">${escapeHtml(partnerLabel)} concluiu todas as ${stageCount} etapas do Kaspersky Partner Quest.</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                ${infoRow(assetsBaseUrl, 'trophy-teal', 'Etapas concluídas:', `${stageCount} de ${stageCount}`)}
                ${infoRow(assetsBaseUrl, 'calendar', 'Data de conclusão:', formatDateTimeBR(completedAt))}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding:0 0 6px 0;border-bottom:1px solid ${BRAND.border};font-size:1px;line-height:1px;">&nbsp;</td>
              </tr></table>

              <p style="margin:24px 0 24px 0;font-size:15px;line-height:22px;color:${BRAND.text};">Confira as recompensas e o histórico do parceiro no Portal Admin.</p>

              ${renderButton(ctaUrl, 'Ver progresso do parceiro')}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              <p style="margin:0;font-size:14px;line-height:20px;color:${BRAND.text};">Kaspersky Partner Quest · Portal Admin</p>`;

  return {
    subject: `Parceiro concluiu o programa: ${partnerLabel}`,
    html: renderLayout({
      preheader: `${partnerLabel} concluiu todas as ${stageCount} etapas do programa.`,
      header: renderHero(assetsBaseUrl, {
        file: 'program-completed-admin-hero.png',
        alt: 'Kaspersky Partner Quest — Um parceiro concluiu o programa.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
