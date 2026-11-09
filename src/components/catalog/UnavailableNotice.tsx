interface UnavailableNoticeProps {
  title: string;
  text: string;
}

/** Katalog kaynağına (AniList) ulaşılamadığında gösterilen açık uyarı. Uydurma içerik gösterilmez. */
export default function UnavailableNotice({ title, text }: UnavailableNoticeProps) {
  return (
    <div role="alert" className="mb-8 rounded-xl border border-volt/60 bg-volt/15 px-5 py-4">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}
