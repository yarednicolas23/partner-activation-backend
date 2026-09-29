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

export interface EvidenceReviewEmailParams {
  partnerLabel: string;
  milestoneTitle: string;
  missionTitle: string;
  submittedAt: Date;
  /** Destino del botón (hoy `${FRONTEND_URL}/admin/evidence`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

const DETAIL_BG = '#EEF2F5';

function detailRow(
  assetsBaseUrl: string,
  icon: string,
  label: string,
  value: string,
): string {
  return `<tr>
                  <td width="150" style="width:150px;padding:12px 10px;background-color:${DETAIL_BG};">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="padding-right:12px;vertical-align:middle;"><img src="${assetsBaseUrl}/icons/${icon}.png" width="20" height="20" alt="" style="display:block;border:0;" /></td>
                      <td style="vertical-align:middle;font-family:${BRAND.bodyFont};font-size:14px;line-height:18px;font-weight:bold;color:${BRAND.text};">${label}</td>
                    </tr></table>
                  </td>
                  <td width="14" style="width:14px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="padding:12px 18px;background-color:${DETAIL_BG};font-family:${BRAND.bodyFont};font-size:14px;line-height:18px;color:${BRAND.text};">${escapeHtml(value)}</td>
                </tr>
                <tr><td colspan="3" style="height:8px;font-size:1px;line-height:8px;">&nbsp;</td></tr>`;
}

/** Aviso a los admins: un partner envió evidencia que hay que validar. */
export function evidenceReviewEmail({
  partnerLabel,
  milestoneTitle,
  missionTitle,
  submittedAt,
  ctaUrl,
  assetsBaseUrl,
}: EvidenceReviewEmailParams): EmailTemplate {
  const details = [
    detailRow(assetsBaseUrl, 'user', 'Parceiro', partnerLabel),
    detailRow(assetsBaseUrl, 'layers', 'Etapa', milestoneTitle),
    detailRow(assetsBaseUrl, 'file', 'Missão', missionTitle),
    detailRow(
      assetsBaseUrl,
      'calendar',
      'Data de envio',
      formatDateTimeBR(submittedAt),
    ),
  ].join('');

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Nova comprovação<br /><span style="color:${BRAND.teal};">aguardando validação</span>
              </h1>
              <p style="${STYLES.p}">Uma nova comprovação foi enviada e está aguardando revisão no Kaspersky Partner Quest.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
                ${details}
              </table>

              <p style="${STYLES.lead}">Acesse o Portal Admin para revisar a comprovação e atualizar o status.</p>

              ${renderButton(ctaUrl, 'Validar comprovação')}

              <div style="height:32px;line-height:32px;font-size:1px;">&nbsp;</div>
              <p style="margin:0;font-size:14px;line-height:20px;color:${BRAND.text};">Kaspersky Partner Quest · Portal Admin</p>`;

  return {
    subject: `Nova comprovação aguardando validação — ${partnerLabel}`,
    html: renderLayout({
      preheader: `${partnerLabel} enviou uma comprovação para a missão ${missionTitle}.`,
      header: renderHero(assetsBaseUrl, {
        file: 'evidence-review-hero.png',
        alt: 'Kaspersky Partner Quest — Uma nova comprovação está aguardando revisão.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
