import { site } from '@/lib/site';

/** 이용약관·개인정보 처리방침이 공유하는 문서 레이아웃. */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
      <header className="max-w-[46ch]">
        <h1 className="text-[32px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[38px]">
          {title}
        </h1>
        <p className="mt-5 text-[15px] leading-[1.8] text-subtle">{summary}</p>
        <p className="mt-5 text-[13px] text-subtle">시행일: {site.effectiveDate}</p>
      </header>

      <article
        className={[
          'mt-14 max-w-[62ch]',
          '[&_h2]:mt-12 [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:text-ink',
          '[&_h2:first-child]:mt-0',
          '[&_p]:mt-3.5 [&_p]:text-[14.5px] [&_p]:leading-[1.9] [&_p]:text-subtle',
          '[&_ul]:mt-3.5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5',
          '[&_ol]:mt-3.5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5',
          '[&_li]:text-[14.5px] [&_li]:leading-[1.9] [&_li]:text-subtle',
          '[&_li::marker]:text-blob',
          '[&_strong]:font-semibold [&_strong]:text-ink',
          '[&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2',
          '[&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse',
          '[&_th]:border-b [&_th]:border-line [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[13px] [&_th]:font-semibold [&_th]:text-ink',
          '[&_td]:border-b [&_td]:border-line [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_td]:text-[13.5px] [&_td]:leading-[1.8] [&_td]:text-subtle',
        ].join(' ')}
      >
        {children}
      </article>
    </div>
  );
}
