import { z } from 'zod';
import { locales } from '@/lib/i18n';

/** İletişim formu: istemci ve sunucu aynı sınırları kullanır. */
export const CONTACT_LIMITS = { name: 80, email: 200, message: 4000, minMessage: 5 } as const;

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(CONTACT_LIMITS.name),
  email: z.string().trim().email().max(CONTACT_LIMITS.email),
  message: z.string().trim().min(CONTACT_LIMITS.minMessage).max(CONTACT_LIMITS.message),
  locale: z.enum(locales).default('tr'),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Gönderim hedeflerine giden son mesaj biçimi */
export interface ContactMessage extends ContactInput {
  receivedAt: string;
}
