import { useEffect } from 'react'
import { ArrowRight, LayoutDashboard, UserRoundPlus } from 'lucide-react'
import { Logo } from './components/ui'

const PORTALS = [
  {
    href: '/apply',
    icon: UserRoundPlus,
    title: 'Applicant portal',
    who: 'For candidates',
    body: 'Apply for Product Manager or Senior Product Manager at Kargo. Upload your resume and confirm your details.',
    cta: 'Apply now',
  },
  {
    href: '/admin',
    icon: LayoutDashboard,
    title: 'Admin portal',
    who: 'For the Kargo team',
    body: 'Ranked candidates, PM and Senior PM scores with evidence, interview briefs, and one-click emails.',
    cta: 'Open dashboard',
  },
]

export default function Home() {
  useEffect(() => {
    document.title = 'HRLY · Innovative hiring'
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    document.documentElement.classList.toggle('dark', mq.matches)
  }, [])

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-brand-50 via-zinc-50 to-zinc-50 dark:from-brand-700/10 dark:via-zinc-950 dark:to-zinc-950">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-12">
        <Logo />
        <h1 className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">Hiring at Kargo</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Choose where you'd like to go.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PORTALS.map(({ href, icon: Icon, title, who, body, cta }) => (
            <a key={href} href={href}
              className="card group flex flex-col p-6 transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-xl hover:shadow-brand-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <div className="grid size-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <Icon className="size-5" />
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">{who}</div>
              <h2 className="mt-1 text-xl font-bold">{title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-300">
                {cta}<ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>
      </main>
      <footer className="py-5 text-center text-xs text-zinc-500">HRLY · Innovative hiring</footer>
    </div>
  )
}
