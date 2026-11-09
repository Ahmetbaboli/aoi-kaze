import 'server-only';

/**
 * Açık lisanslı Blender filmlerinin atıfları (eser slug'ına göre). Başka eserler için atıf null kalır;
 * oynatıcı arayüzü (Aşama 2) bu değeri varsa gösterir.
 */
const OPEN_FILM_ATTRIBUTION: Record<string, string> = {
  'big-buck-bunny': 'Big Buck Bunny © Blender Foundation | www.blender.org, CC BY 3.0',
  sintel: 'Sintel © Blender Foundation | www.blender.org, CC BY 3.0',
  'tears-of-steel': 'Tears of Steel © Blender Foundation | www.blender.org, CC BY 3.0',
};

export const attributionFor = (animeSlug: string | null | undefined): string | null =>
  (animeSlug && OPEN_FILM_ATTRIBUTION[animeSlug]) || null;
