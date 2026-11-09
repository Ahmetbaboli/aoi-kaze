export type Accent = 'primary' | 'volt' | 'night';

export interface NavItem {
  /** Masaüstü üst çubukta görünür (diğerleri yalnızca mobil menü ve footer) */
  primary?: boolean;
  href: string;
  label: string;
}

export interface Skill {
  name: string;
  note: string;
}

export interface ProjectLink {
  label: string;
  href: string;
}

export interface Project {
  id: string;
  title: string;
  year: string;
  tags: string[];
  summary: string;
  description: string;
  accent: Accent;
  links: ProjectLink[];
  /** İsteğe bağlı kapak görseli (public/ altından), next/image ile gösterilir */
  image?: string;
}

export type SocialId = 'github' | 'linkedin' | 'twitter' | 'mail';

export interface Social {
  id: SocialId;
  label: string;
  href: string;
}
