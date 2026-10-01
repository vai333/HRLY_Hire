import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, KeyRound, LogOut, Mail, Moon, Sun, Users, FileText, X } from 'lucide-react'
import { api, passcode } from './api'
import CandidateQueue, { summarise } from './components/CandidateQueue'
import EvidencePane from './components/EvidencePane'
import EmailPane from './components/EmailPane'
import { Button, Logo, cx } from './components/ui'

function PasscodeGate({ onUnlock, error }) {
  const [value, setValue] = useState('')
  return (
    <div className="grid h-full place-items-center p-4">
      <form className="card w-full max-w-sm space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); onUnlock(value) }}>
        <Logo />
        <div>
          <h1 className="text-lg font-bold">Admin portal</h1>
          <p className="text-sm text-zinc-500">Enter the HRLY passcode to open the hiring dashboard.</p>
        </div>
        <input className="field" type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Passcode" />
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <Button variant="primary" className="w-full" type="submit"><KeyRound className="size-4" />Unlock</Button>
      </form>
    </div>
  )
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('hrly-theme', dark ? 'dark' : 'light') } catch { /* private mode */ }
  }, [dark])
  return [dark, setDark]
}

export default function App() {
  const [locked, setLocked] = useState(false)
  const [gateError, setGateError] = useState('')
  const [config, setConfig] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [uploads, setUploads] = useState([])
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)
  const [mobileTab, setMobileTab] = useState('queue')
  const [dark, setDark] = useTheme()
  const selectedRef = useRef(null)
  selectedRef.current = selectedId

  const notify = (msg, tone = 'error') => { setToast({ msg, tone }); setTimeout(() => setToast(null), 5000) }
  const handle = (e) => { if (e.status === 401) { setLocked(true); passcode.clear() } else notify(e.message) }

  const refresh = useCallback(async () => {
    try { setCandidates(await api.list()) } catch (e) { handle(e) } finally { setLoading(false) }
  }, [])

  const boot = useCallback(async () => {
    try {
      setConfig(await api.config())
      setLocked(false)
      await refresh()
    } catch (e) {
      if (e.status === 401) { setLocked(true); setLoading(false) } else { notify(e.message); setLoading(false) }
    }
  }, [refresh])

  useEffect(() => { document.title = 'HRLY Admin · Innovative hiring' }, [])
  useEffect(() => { boot() }, [boot])

  const select = useCallback(async (id) => {
    setSelectedId(id)
    setMobileTab('brief')
    try {
      const d = await api.get(id)
      if (selectedRef.current === id) setDetail(d)
    } catch (e) { handle(e) }
  }, [])

  // Auto-select the top-ranked candidate on first load.
  useEffect(() => {
    if (!selectedId && candidates.length) {
      const top = candidates.map(summarise).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0]
      select(top.id)
      setMobileTab('queue')
    }
  }, [candidates, selectedId, select])

  // j / k keyboard navigation through the ranked queue.
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey) return
      if (e.key !== 'j' && e.key !== 'k') return
      const ranked = candidates.map(summarise).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      const i = ranked.findIndex((c) => c.id === selectedId)
      const next = ranked[Math.max(0, Math.min(ranked.length - 1, i + (e.key === 'j' ? 1 : -1)))]
      if (next && next.id !== selectedId) select(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [candidates, selectedId, select])

  const onUpload = async (files, role) => {
    const items = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, file: f, state: 'queued' }))
    setUploads((u) => [...items, ...u])
    for (const item of items) {
      setUploads((u) => u.map((x) => (x.key === item.key ? { ...x, state: 'running' } : x)))
      try {
        if (item.file.size > 4 * 1024 * 1024) throw new Error('File is larger than 4 MB')
        const d = await api.upload(item.file, role)
        setUploads((u) => u.filter((x) => x.key !== item.key))
        setSelectedId(d.candidate.id)
        setDetail(d)
        setMobileTab('brief')
      } catch (e) {
        if (e.status === 401) return handle(e)
        setUploads((u) => u.map((x) => (x.key === item.key ? { ...x, state: 'error', error: e.message } : x)))
        setTimeout(() => setUploads((u) => u.filter((x) => x.key !== item.key)), 12000)
      }
      refresh()
    }
  }

  const act = async (name, fn, okMsg) => {
    setBusy(name)
    try {
      const d = await fn()
      if (d?.candidate) setDetail(d)
      if (okMsg) notify(okMsg, 'ok')
      refresh()
      return d
    } catch (e) { handle(e); if (name === 'rescore' || name === 'send') select(selectedId) } finally { setBusy(null) }
  }

  if (locked) {
    return <PasscodeGate error={gateError} onUnlock={async (v) => {
      passcode.set(v)
      try { setConfig(await api.config()); setLocked(false); setGateError(''); setLoading(true); refresh() } catch { setGateError('Incorrect passcode') }
    }} />
  }

  const panes = [
    ['queue', 'Queue', Users],
    ['brief', 'Brief', FileText],
    ['email', 'Email', Mail],
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center gap-4">
          <a href="/" aria-label="HRLY home"><Logo /></a>
          {config && (
            <div className="hidden border-l border-zinc-200 pl-4 text-xs leading-tight text-zinc-500 sm:block dark:border-zinc-800">
              <div className="font-semibold text-zinc-700 dark:text-zinc-300">{config.company} · Product hiring</div>
              <div>{config.founder}'s command center</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <a href="/apply" target="_blank" rel="noreferrer"
            className="mr-1 hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 sm:inline-flex dark:text-zinc-400 dark:hover:bg-zinc-800">
            <ExternalLink className="size-3.5" />Applicant portal
          </a>
          <Button variant="ghost" size="sm" onClick={() => setDark((d) => !d)} aria-label="Toggle theme">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {passcode.get() && (
            <Button variant="ghost" size="sm" aria-label="Lock" onClick={() => { passcode.clear(); setLocked(true) }}><LogOut className="size-4" /></Button>
          )}
        </div>
      </header>

      {/* Mobile pane switcher */}
      <nav className="grid shrink-0 grid-cols-3 border-b border-zinc-200 lg:hidden dark:border-zinc-800">
        {panes.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setMobileTab(k)}
            className={cx('flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold',
              mobileTab === k ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-300' : 'text-zinc-500')}>
            <Icon className="size-3.5" />{label}
          </button>
        ))}
      </nav>

      <main className="grid min-h-0 flex-1 lg:grid-cols-[290px_minmax(0,1fr)_340px] xl:grid-cols-[330px_minmax(0,1fr)_400px]">
        <aside className={cx('min-h-0 border-zinc-200 bg-white lg:block lg:border-r dark:border-zinc-800 dark:bg-zinc-950', mobileTab === 'queue' ? 'block' : 'hidden')}>
          <CandidateQueue candidates={candidates} selectedId={selectedId} onSelect={select} onUpload={onUpload} uploads={uploads} loading={loading} />
        </aside>
        <section className={cx('pane lg:block', mobileTab === 'brief' ? 'block' : 'hidden')}>
          <EvidencePane
            detail={detail} busy={busy}
            onRescore={() => act('rescore', () => api.rescore(detail.candidate.id), 'Rescored against both rubrics')}
            onDelete={() => act('delete', async () => {
              await api.remove(detail.candidate.id); setDetail(null); setSelectedId(null)
            }, 'Candidate deleted')}
          />
        </section>
        <aside className={cx('min-h-0 border-zinc-200 bg-white lg:block lg:border-l dark:border-zinc-800 dark:bg-zinc-950', mobileTab === 'email' ? 'block' : 'hidden')}>
          <EmailPane
            detail={detail} config={config} busy={busy}
            onRegenerate={(t) => act('regenerate', () => api.regenerate(detail.candidate.id, t))}
            onSave={(f) => api.editEmail(detail.candidate.id, { to_email: f.to_email, subject: f.subject, body: f.body }).then(setDetail).catch(handle)}
            onSend={() => act('send', () => api.send(detail.candidate.id), 'Email sent via Resend')}
          />
        </aside>
      </main>

      {toast && (
        <div className={cx('fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg',
          toast.tone === 'ok' ? 'bg-emerald-600' : 'bg-rose-600')}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss"><X className="size-4" /></button>
        </div>
      )}
    </div>
  )
}
