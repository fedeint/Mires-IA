export const APP_CONFIG = {
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 300,
};
