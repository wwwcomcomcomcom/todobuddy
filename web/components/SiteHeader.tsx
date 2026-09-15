import Link from 'next/link';
import { CloverMark } from './CloverMark';
import { site } from '@/lib/site';

const links = [
  { href: '/#features', label: '기능' },
  { href: '/#sharing', label: '공개 범위' },
  { href: '/#download', label: '다운로드' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-white/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <CloverMark className="h-7 w-7" />
          <span className="text-[17px] font-bold tracking-tight">{site.name}</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-[14px] text-subtle transition-colors hover:bg-chip hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/#download"
          className="ml-auto rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-85 sm:ml-0"
        >
          내려받기
        </Link>
      </div>
    </header>
  );
}
