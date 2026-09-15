import Link from 'next/link';
import { CloverMark } from './CloverMark';
import { site } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <CloverMark className="h-6 w-6" />
            <span className="text-[15px] font-bold">{site.name}</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-subtle">{site.description}</p>
        </div>

        <nav className="flex flex-col gap-2.5 text-[14px]">
          <Link href="/terms" className="text-subtle transition-colors hover:text-ink">
            이용약관
          </Link>
          <Link href="/privacy" className="text-subtle transition-colors hover:text-ink">
            개인정보 처리방침
          </Link>
          <a
            href={site.repoUrl}
            className="text-subtle transition-colors hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            GitHub 저장소
          </a>
          <a
            href={`mailto:${site.contactEmail}`}
            className="text-subtle transition-colors hover:text-ink"
          >
            {site.contactEmail}
          </a>
        </nav>
      </div>

      <div className="mx-auto max-w-[1120px] px-5 pb-10 text-[12.5px] text-subtle sm:px-8">
        © {new Date().getFullYear()} {site.name}
      </div>
    </footer>
  );
}
