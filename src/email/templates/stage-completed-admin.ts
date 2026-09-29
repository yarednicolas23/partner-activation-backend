import {
  BRAND,
  escapeHtml,
  formatDateTimeBR,
  renderButton,
  renderHero,
  renderLayout,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface StageCompletedAdminEmailParams {
  partnerLabel: string;
  stageNumber: number;
  stageTitle: string;
  /** Mismo nombre provisional que recibe el partner (ver stage-completed.ts). */
  achievementTitle: string;
  completedAt: Date;
  /** true en la última etapa: no hay "próxima etapa" que liberar. */
  isLastStage: boolean;
  /** Destino del botón (hoy `${FRONTEND_URL}/admin/partners/{id}`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

function infoRow(
  assetsBaseUrl: string,
  icon: string,
  label: string,
  value: string,
): string {
  return `<tr>
                  <td width="48" style="width:48px;padding:0 0 18px 0;vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td width="48" height="48" align="center" style="width:48px;height:48px;background-color:#EEF2F5;border-radius:10px;"><img src="${assetsBaseUrl}/icons/${icon}.png" width="26" height="26" alt="" style="display:block;border:0;" /></td>
                    </tr></table>
                  </td>
                  <td style="padding:0 0 18px 18px;vertical-align:middle;font-family:${BRAND.bodyFont};font-size:15px;line-height:21px;color:${BRAND.text};">${label}<br /><strong>${escapeHtml(value)}</strong></td>
                </tr>`;
}

/** Aviso a los admins: un partner completó una etapa (milestone). */
export function stageCompletedAdminEmail({
  partnerLabel,
  stageNumber,
  stageTitle,
  achievementTitle,
  completedAt,
  isLastStage,
  ctaUrl,
  assetsBaseUrl,
}: StageCompletedAdminEmailParams): EmailTemplate {
  const nextStep = isLastStage
    ? 'Com esta etapa, o parceiro concluiu todas as etapas da jornada.'
    : 'A próxima etapa da jornada foi liberada para o parceiro.';

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Etapa <span style="color:${BRAND.teal};">concluída</span>
              </h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:22px;font-weight:bold;color:${BRAND.text};">${escapeHtml(partnerLabel)} concluiu a Etapa ${stageNumber} · ${escapeHtml(stageTitle)} do Kaspersky Partner Quest.</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                ${infoRow(assetsBaseUrl, 'trophy-teal', 'Conquista desbloqueada:', achievementTitle)}
                ${infoRow(assetsBaseUrl, 'calendar', 'Data de conclusão:', formatDateTimeBR(completedAt))}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding:0 0 6px 0;border-bottom:1px solid ${BRAND.border};font-size:1px;line-height:1px;">&nbsp;</td>
              </tr></table>

              <p style="margin:24px 0 24px 0;font-size:15px;line-height:22px;color:${BRAND.text};">${nextStep}</p>

              ${renderButton(ctaUrl, 'Ver progresso do parceiro')}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              <p style="margin:0;font-size:14px;line-height:20px;color:${BRAND.text};">Kaspersky Partner Quest · Portal Admin</p>`;

  return {
    subject: `Etapa concluída: ${partnerLabel} — Etapa ${stageNumber} · ${stageTitle}`,
    html: renderLayout({
      preheader: `${partnerLabel} concluiu a Etapa ${stageNumber} · ${stageTitle}.`,
      header: renderHero(assetsBaseUrl, {
        file: 'stage-completed-admin-hero.png',
        alt: 'Kaspersky Partner Quest — Um parceiro avançou de etapa no programa.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
