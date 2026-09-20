import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { CheckIcon } from './icons'

/**
 * Small shared controls. Every tappable thing here has a hit area of at least 44px
 * (Apple HIG) even when the visible shape is smaller.
 */

export type Tone = 'neutral' | 'accent' | 'danger' | 'warn' | 'success'

const RING: Record<Tone, string> = {
  neutral: 'border-line-strong',
  accent: 'border-accent',
  danger: 'border-danger',
  warn: 'border-warn',
  success: 'border-success',
}

const FILL: Record<Tone, string> = {
  neutral: 'bg-fg border-fg text-bg',
  accent: 'bg-accent border-accent text-accent-fg',
  danger: 'bg-danger border-danger text-white',
  warn: 'bg-warn border-warn text-white',
  success: 'bg-success border-success text-white',
}

/** Round check control. `tone` colours the empty ring (priority) and the filled state. */
export function CircleCheck({
  checked,
  onChange,
  label,
  tone = 'neutral',
  size = 'md',
  className = '',
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  tone?: Tone
  size?: 'md' | 'lg'
  className?: string
}) {
  const dim = size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${className}`}
    >
      <span
        className={`grid ${dim} place-items-center rounded-full border-2 transition-colors ${
          checked ? FILL[tone === 'neutral' ? 'accent' : tone] : `${RING[tone]} bg-surface`
        }`}
      >
        {checked && <CheckIcon size={size === 'lg' ? 18 : 14} strokeWidth={3} />}
      </span>
    </button>
  )
}

/** One-of-N control. Each option is a tappable pill; the chosen one is filled. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  tones,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
  /** Optional per-option tone for the selected state (e.g. urgent → danger). */
  tones?: Partial<Record<T, Tone>>
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value
        const tone = tones?.[o.value] ?? 'neutral'
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${
              active ? FILL[tone] : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-2'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Small pill for secondary information (due dates, tags, counts). */
export function Chip({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  const tones: Record<Tone, string> = {
    neutral: 'bg-surface-2 text-fg-muted',
    accent: 'bg-accent-soft text-accent',
    danger: 'bg-danger-soft text-danger',
    warn: 'bg-warn-soft text-warn',
    success: 'bg-success-soft text-success',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

/** Tappable chip (quick actions like "Today" / "Tomorrow"). `tone` colours the active state. */
export function ChipButton({
  active = false,
  tone = 'neutral',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; tone?: Tone }) {
  return (
    <button
      type="button"
      className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${
        active ? FILL[tone] : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-2'
      } disabled:opacity-40 ${className}`}
      {...rest}
    />
  )
}

/** Primary / secondary buttons, 44px tall. */
export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const variants = {
    primary: 'bg-fg text-bg hover:opacity-90',
    secondary: 'border border-line-strong bg-surface hover:bg-surface-2',
    ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
    danger: 'text-danger hover:bg-danger-soft',
  }
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-40 ${variants[variant]} ${className}`}
      {...rest}
    />
  )
}

/** Icon-only button with a full 44px hit area. */
export function IconButton({ label, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30 ${className}`}
      {...rest}
    />
  )
}

/** Text field styling shared by every form. */
export const field =
  'w-full min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-fg outline-none placeholder:text-fg-faint focus:border-accent md:text-sm'

/** Uppercase section label used on Home, Archive, the editor. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-xs font-semibold uppercase tracking-wide text-fg-muted ${className}`}>{children}</div>
}
