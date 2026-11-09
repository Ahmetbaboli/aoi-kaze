import type { ContactMessage } from './schema';

/**
 * Mesajın gönderileceği hedefler. İkisi de isteğe bağlıdır ve birlikte çalışabilir:
 *  - Webhook: CONTACT_WEBHOOK_URL (n8n, Zapier, Make, kendi sunucun...)
 *  - Resend:  RESEND_API_KEY + CONTACT_TO_EMAIL + CONTACT_FROM_EMAIL
 * Yeni bir hedef eklemek için `Sink` arayüzünü uygulayıp `activeSinks()` listesine eklemek yeterli.
 */
export interface Sink {
  name: string;
  send: (message: ContactMessage) => Promise<void>;
}

const TIMEOUT_MS = 8000;
const SITE_NAME = 'Aoi Kaze';

/** E-posta başlığına satır sonu sızmasını (header injection) engeller. */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

const webhookSink = (url: string): Sink => ({
  name: 'webhook',
  async send(message) {
    const secret = process.env.CONTACT_WEBHOOK_SECRET;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Webhook-Secret': secret } : {}) },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Webhook ${response.status}`);
  },
});

const resendSink = (apiKey: string, to: string[], from: string): Sink => ({
  name: 'resend',
  async send(message) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        reply_to: message.email,
        subject: `[${SITE_NAME}] ${oneLine(message.name)}`,
        // Düz metin: HTML üretmediğimiz için içerik enjeksiyonu riski yok.
        text: `${message.message}\n\n—\n${message.name} <${message.email}>\n${message.receivedAt} (${message.locale})`,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}`);
  },
});

export function activeSinks(): Sink[] {
  const sinks: Sink[] = [];

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (webhook) sinks.push(webhookSink(webhook));

  const { RESEND_API_KEY: key, CONTACT_TO_EMAIL: to, CONTACT_FROM_EMAIL: from } = process.env;
  if (key && to && from) {
    sinks.push(resendSink(key, to.split(',').map((address) => address.trim()).filter(Boolean), from));
  }

  return sinks;
}

export class NotConfiguredError extends Error {}

/**
 * En az bir hedef başarılıysa teslim edilmiş sayılır. Hiç hedef yoksa geliştirmede konsola yazılır,
 * üretimde hata verilir (mesaj sessizce kaybolmasın).
 */
export async function deliver(message: ContactMessage): Promise<void> {
  const sinks = activeSinks();

  if (sinks.length === 0) {
    if (process.env.NODE_ENV === 'production') throw new NotConfiguredError('İletişim hedefi tanımlı değil');
    console.log('[iletişim] (geliştirme: hedef tanımlı değil, konsola yazıldı)', message);
    return;
  }

  const results = await Promise.allSettled(sinks.map((sink) => sink.send(message)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') console.error(`[iletişim] ${sinks[index].name} başarısız:`, result.reason);
  });
  if (!results.some((result) => result.status === 'fulfilled')) throw new Error('Tüm hedefler başarısız');
}
