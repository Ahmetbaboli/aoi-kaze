/**
 * Discord sunucusu davet linki (NEXT_PUBLIC_DISCORD_INVITE). Yalnızca https:// ile başlıyorsa geçerlidir;
 * tanımsız ya da geçersizse undefined döner ve link hiç gösterilmez.
 */
export function discordInviteUrl(): string | undefined {
  const value = process.env.NEXT_PUBLIC_DISCORD_INVITE?.trim();
  return value && /^https:\/\//i.test(value) ? value : undefined;
}
