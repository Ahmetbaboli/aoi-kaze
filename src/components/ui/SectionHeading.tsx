interface SectionHeadingProps {
  title: string;
  subtitle?: string;
}

export default function SectionHeading({ title, subtitle }: SectionHeadingProps) {
  return (
    <header className="mb-8 sm:mb-10">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-2xl text-lg text-muted">{subtitle}</p>}
    </header>
  );
}
