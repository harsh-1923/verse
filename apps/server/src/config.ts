export const config = {
  port: Number(process.env.PORT ?? 3000),
  convexUrl: process.env.CONVEX_URL ?? '',
  convexSiteUrl: process.env.CONVEX_SITE_URL ?? '',
  convexJwksUrl: process.env.CONVEX_JWKS_URL ?? process.env.CONVEX_SITE_URL ?? '',
  convexServiceKey: process.env.CONVEX_SERVICE_KEY ?? '',
  convexAdminKey: process.env.CONVEX_ADMIN_KEY ?? '',
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? '*',
}
