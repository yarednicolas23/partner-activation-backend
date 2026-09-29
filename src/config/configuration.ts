export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL,
  // Imágenes de los emails (frontend/public/emails). Debe ser una URL pública:
  // en local FRONTEND_URL es localhost y los clientes de correo no pueden
  // cargarla, así que se puede apuntar a un deploy (ej. staging).
  emailAssetsUrl:
    process.env.EMAIL_ASSETS_URL ??
    (process.env.FRONTEND_URL && `${process.env.FRONTEND_URL}/emails`),
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  aws: {
    region: process.env.AWS_REGION,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  },
});
