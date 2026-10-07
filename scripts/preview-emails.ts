/**
 * Renderiza las plantillas de src/email/templates a email-previews/*.html
 * para revisarlas en el navegador sin enviar nada:
 *   npm run email:preview
 * Las imágenes salen de EMAIL_ASSETS_URL (por defecto el frontend local).
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  accessLinkEmail,
  loginLinkEmail,
  programCompletedEmail,
  evidenceReceivedEmail,
  evidenceReviewEmail,
  stageCompletedAdminEmail,
  stageCompletedEmail,
  welcomeEmail,
} from '../src/email/templates';

const assetsBaseUrl =
  process.env.EMAIL_ASSETS_URL ?? 'http://localhost:3000/emails';
const outDir = join(__dirname, '..', 'email-previews');

const previews = {
  welcome: welcomeEmail({
    ctaUrl: 'http://localhost:3000/login',
    assetsBaseUrl,
  }),
  'access-link': accessLinkEmail({
    actionLink: 'http://localhost:3000/auth/callback#access_token=preview',
    loginUrl: 'http://localhost:3000/login',
    fullName: 'Maria Silva',
    assetsBaseUrl,
  }),
  'login-link-partner': loginLinkEmail({
    actionLink: 'http://localhost:3000/auth/callback#access_token=preview',
    role: 'partner',
    assetsBaseUrl,
  }),
  'login-link-admin': loginLinkEmail({
    actionLink: 'http://localhost:3000/auth/callback#access_token=preview',
    role: 'admin',
    assetsBaseUrl,
  }),
  'evidence-received': evidenceReceivedEmail({
    missionTitle: 'Logo da Kaspersky no site do parceiro',
    ctaUrl: 'http://localhost:3000/dashboard',
    assetsBaseUrl,
  }),
  'evidence-review': evidenceReviewEmail({
    partnerLabel: 'Maria Silva (Tech Solutions Ltda.)',
    milestoneTitle: 'Descoberta',
    missionTitle: 'Logo da Kaspersky no site do parceiro',
    submittedAt: new Date('2026-09-28T21:15:00Z'),
    ctaUrl: 'http://localhost:3000/admin/evidence',
    assetsBaseUrl,
  }),
  'stage-completed': stageCompletedEmail({
    stageNumber: 1,
    stageTitle: 'Descoberta',
    achievementTitle: 'Etapa 1: Descoberta',
    rewardTitles: ['Kit onboarding'],
    ctaUrl: 'http://localhost:3000/dashboard',
    assetsBaseUrl,
  }),
  'stage-completed-admin': stageCompletedAdminEmail({
    partnerLabel: 'Maria Silva (Tech Solutions Ltda.)',
    stageNumber: 1,
    stageTitle: 'Descoberta',
    achievementTitle: 'Etapa 1: Descoberta',
    completedAt: new Date('2026-09-28T21:15:00Z'),
    isLastStage: false,
    ctaUrl: 'http://localhost:3000/admin/partners/preview',
    assetsBaseUrl,
  }),
  'program-completed': programCompletedEmail({
    partnerName: 'Maria Silva',
    stageCount: 5,
    ctaUrl: 'http://localhost:3000/dashboard',
    assetsBaseUrl,
  }),
};

mkdirSync(outDir, { recursive: true });
for (const [name, { html }] of Object.entries(previews)) {
  writeFileSync(join(outDir, `${name}.html`), html);
  console.log(`email-previews/${name}.html`);
}
