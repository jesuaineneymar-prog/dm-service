// ============================================================
//  AURA SOCIAL DM ENGINE v4 — Instagram + Facebook
//  Steel.dev anti-detection browser + Browserless fallback
//  Funcoes originais TikTok mantidas como aliases
//  NOTA: O motor CDP principal para IG+FB esta em steel-social-dm.ts
//  Este ficheiro re-exporta e adiciona compatibilidade
// ============================================================

// Re-export tudo do steel-social-dm (motor CDP principal)
export {
  steelIGSendDM,
  steelFBSendDM,
  steelBulkDM,
  steelCreateLoginSession,
  steelCheckLogin,
  steelSocialDMStatus,
  steelClearSessions,
  steelScreenshot,
} from './steel-social-dm';

// Re-export type
export type { SocialDMResult } from './steel-social-dm';

// Alias tipo para compatibilidade
export type { SocialDMResult as TikTokDMResult } from './steel-social-dm';
