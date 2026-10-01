import { Loader2 } from 'lucide-react'

export const cx = (...c) => c.filter(Boolean).join(' ')

export const BAND_STYLES = {
  'Strong advance': 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  'Advance with probes': 'bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  Hold: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  Decline: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300',
}

export function scoreColor(score) {
  if (score == null) return 'text-zinc-400'
  if (score >= 8) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 6.5) return 'text-sky-600 dark:text-sky-400'
  if (score >= 5) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

export function BandPill({ band, size = 'sm' }) {
  if (!band) return null
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
      size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]', BAND_STYLES[band])}>
      {band}
    </span>
  )
}

export function Badge({ children, className, title }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium', className)}>
      {children}
    </span>
  )
}

export function Button({ children, variant = 'secondary', size = 'md', loading, className, ...props }) {
  const variants = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/20',
    secondary: 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
    ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
    danger: 'border border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }
  const sizes = { sm: 'h-7 px-2.5 text-xs', md: 'h-9 px-3.5 text-sm', lg: 'h-11 px-5 text-sm' }
  return (
    <button
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40', variants[variant], sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function LevelDots({ level, max = 4 }) {
  return (
    <div className="flex gap-0.5" aria-label={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cx('h-1.5 w-4 rounded-full',
          i < level ? (level >= 3 ? 'bg-emerald-500' : level === 2 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-zinc-200 dark:bg-zinc-800')} />
      ))}
    </div>
  )
}

export function Logo({ compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid size-8 place-items-center rounded-lg bg-brand-500 font-black text-white shadow-md shadow-brand-500/30">
        H<span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-zest ring-2 ring-zinc-50 dark:ring-zinc-950" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-black tracking-tight">HRLY</div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Innovative hiring</div>
        </div>
      )}
    </div>
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      {Icon && <Icon className="size-8 text-zinc-300 dark:text-zinc-700" />}
      <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{title}</div>
      {children && <div className="max-w-xs text-xs text-zinc-500">{children}</div>}
    </div>
  )
}

export function Section({ title, right, children, className }) {
  return (
    <section className={cx('card p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="label">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}
