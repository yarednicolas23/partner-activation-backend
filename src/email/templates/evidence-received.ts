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

export interface EvidenceReceivedEmailParams {
  /** Título de la tarea (misión) a la que pertenece la evidencia. */
  missionTitle: string;
  /** Destino del botón (hoy `${FRONTEND_URL}/dashboard`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

/** Confirmación al partner de que su evidencia quedó en revisión. */
export function evidenceReceivedEmail({
  missionTitle,
  ctaUrl,
  assetsBaseUrl,
}: EvidenceReceivedEmailParams): EmailTemplate {
  const body = `<h1 class="h1" style="${STYLES.h1}">
                Recebemos sua <span style="color:${BRAND.teal};">comprovação!</span>
              </h1>
              <p style="${STYLES.p}">Sua comprovação para a missão <strong>${escapeHtml(missionTitle)}</strong> foi enviada com sucesso e já está em análise pela equipe Kaspersky.</p>
              <p style="${STYLES.p}">Assim que a validação for concluída, você receberá uma atualização sobre o status da missão.</p>
              <p style="${STYLES.lead}">Enquanto isso, continue de olho na sua jornada e prepare-se para o próximo desafio.</p>

              ${renderButton(ctaUrl, 'Acessar minha jornada')}

              <div style="height:40px;line-height:40px;font-size:1px;">&nbsp;</div>
              ${SIGNOFF}`;

  return {
    subject: 'Recebemos sua comprovação — Kaspersky Partner Quest',
    html: renderLayout({
      preheader: `Sua comprovação para a missão ${missionTitle} já está em análise.`,
      header: renderHero(assetsBaseUrl, {
        file: 'evidence-received-hero.png',
        alt: 'Kaspersky Partner Quest — Recebemos sua comprovação e ela já está em análise!',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
