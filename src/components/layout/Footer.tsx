import Link from '@/components/ui/LocLink';
import type { Content } from '@/content';
import { fmt } from '@/lib/utils';
import Wordmark from '@/components/ui/Wordmark';

interface FooterProps {
  content: Content['footer'];
  links: Content['nav'];
  discordInvite?: string;
  discordLabel?: string;
}

export default function Footer({ content, links, discordInvite, discordLabel }: FooterProps) {
  return (
    <footer className="defer-render mt-16 border-t border-line bg-night text-[#F1F3FA]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
        <Wordmark name="Aoi Kaze" />
        <nav aria-label={content.linksLabel}>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-[#F1F3FA]/90 hover:text-white hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {discordInvite && (
          <a href={discordInvite} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#F1F3FA] hover:underline">
            {discordLabel} ↗
          </a>
        )}
        <p className="max-w-2xl text-xs text-[#F1F3FA]/70">{content.dataCredit}</p>
        <p className="text-xs text-[#F1F3FA]/70">{content.note}</p>
        <p className="text-xs text-[#F1F3FA]/70">{fmt(content.rights, { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
