import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon, type IconName } from './Icon';

type Variant = 'filled' | 'outlined' | 'text' | 'tonal' | 'danger' | 'dangerText';

const VARIANTS: Record<Variant, string> = {
  filled: 'bg-ink text-white hover:bg-ink/85 disabled:bg-ink/30',
  outlined: 'border border-line text-ink hover:bg-chip disabled:text-subtle',
  text: 'text-ink hover:bg-chip disabled:text-subtle',
  tonal: 'bg-chip text-ink hover:bg-blob disabled:text-subtle',
  danger: 'bg-sunday text-white hover:bg-sunday/85 disabled:bg-sunday/30',
  dangerText: 'text-sunday hover:bg-sunday/10 disabled:text-subtle',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  block?: boolean;
  size?: 'md' | 'lg' | 'sm';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'filled', icon, block, size = 'md', className = '', children, type = 'button', ...rest },
  ref,
) {
  const sizing = size === 'lg' ? 'px-5 py-3.5 text-[15px]' : size === 'sm' ? 'px-2.5 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm';
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition-colors ${sizing} ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
});

export function IconButton({
  icon, label, size = 36, iconSize = 20, className = '', ...rest
}: { icon: IconName; label: string; size?: number; iconSize?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-chip disabled:text-blob ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

/** 하위 화면의 상단 막대. 뒤로 가기 + 가운데 제목 + 오른쪽 동작. */
export function ScreenHeader({
  title, onBack, action, backDisabled = false,
}: { title: string; onBack?: () => void; action?: ReactNode; backDisabled?: boolean }) {
  const navigate = useNavigate();
  const back = onBack ?? (() => (window.history.length > 1 ? navigate(-1) : navigate('/')));
  return (
    <header className="safe-pt safe-px sticky top-0 z-20 bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-14 max-w-3xl grid-cols-[3rem_1fr_auto] items-center gap-2">
        <IconButton icon="back" label="뒤로" onClick={back} disabled={backDisabled} />
        <h1 className="truncate text-center text-lg font-extrabold">{title}</h1>
        <div className="flex min-w-12 justify-end">{action}</div>
      </div>
    </header>
  );
}

export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <span
      role="progressbar"
      aria-label="불러오는 중"
      className="inline-block animate-spin rounded-full border-[3px] border-blob border-t-ink"
      style={{ width: size, height: size }}
    />
  );
}

export function LinearProgress({ value }: { value?: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value == null ? undefined : Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative h-1 w-full overflow-hidden rounded-full bg-chip"
    >
      {value == null ? (
        <div className="absolute inset-y-0 w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-full bg-ink" />
      ) : (
        <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.min(1, value) * 100}%` }} />
      )}
      <style>{'@keyframes progress{0%{left:-33%}100%{left:100%}}'}</style>
    </div>
  );
}

export function ErrorText({ children, className = '' }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={`whitespace-pre-line text-[13px] text-sunday ${className}`}>
      {children}
    </p>
  );
}

/** 회색 바탕의 한 줄 설정 항목 (공개설정·색상·날짜 등). */
export function SettingRow({
  label, value, onClick, disabled,
}: { label: string; value: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-xl bg-chip px-[18px] py-4 text-left transition-colors hover:bg-blob/60 disabled:opacity-60"
    >
      <span className="text-[15px] font-bold">{label}</span>
      <span className="ml-auto flex items-center gap-1.5 font-semibold">{value}</span>
      <Icon name="chevronRight" className="text-subtle" />
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-7 mb-1 text-[15px] font-extrabold">{children}</h2>;
}

/** 칩 모양 토글 (요일·날짜 선택 등). */
export function ChipToggle({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        selected ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-chip'
      }`}
    >
      {children}
    </button>
  );
}

/** 여러 선택지 중 하나를 고르는 붙은 버튼 줄. */
export function Segmented<T extends string>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-chip p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
            value === o.value ? 'bg-ink text-white' : 'text-subtle hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-blob'} disabled:opacity-50`}
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 py-2 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="size-[18px] shrink-0 accent-ink"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0 flex-1 text-sm">{label}</span>
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-subtle focus:border-ink pointer-coarse:text-base';

export const visibilityIcon = { private: 'lock', shared: 'groups', public: 'public' } as const;
