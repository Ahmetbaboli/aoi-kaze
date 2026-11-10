/** Profil şikâyeti nedenleri (istemci ve sunucu ortak; içe aktarma yok). moderation-core.ts ile aynı liste. */
export const USER_REPORT_REASONS = ['NAME', 'BIO', 'IMAGE', 'SPAM', 'OTHER'] as const;
export type UserReportReason = (typeof USER_REPORT_REASONS)[number];
