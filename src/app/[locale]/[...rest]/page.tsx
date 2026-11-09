import { notFound } from 'next/navigation';

/** /tr/olmayan/yol gibi eşleşmeyen tüm adresleri dil düzeni içindeki 404'e düşürür. */
export default function CatchAll() {
  notFound();
}
