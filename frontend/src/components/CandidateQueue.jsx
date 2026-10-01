import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, MailCheck, Search, Upload } from 'lucide-react'
import { BandPill, Badge, cx, scoreColor } from './ui'

const one = (x) => (Array.isArray(x) ? x[0] : x)

export function summarise(c) {
  const evs = Object.fromEntries((c.evaluations || []).map((e) => [e.role, e]))
  const applied = evs[c.applied_role]
  return {
    ...c,
    pm: evs.PM?.final_total != null ? Number(evs.PM.final_total) : null,
    spm: evs.SPM?.final_total != null ? Number(evs.SPM.final_total) : null,
    score: applied?.final_total != null ? Number(applied.final_total) : null,
    band: applied?.recommendation,
    mail: one(c.emails),
  }
}

const STAGES = ['Reading CV', 'Shielding personal details', 'Scoring PM & SPM rubrics', 'Drafting brief & email']

function UploadZone({ onUpload, uploads }) {
  const [role, setRole] = useState('PM')
  const [drag, setDrag] = useState(false)
  const input = useRef(null)
  const take = (files) => {
    const list = [...files].filter((f) => /\.(pdf|docx)$/i.test(f.name))
    if (list.length) onUpload(list, role)
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        {[['PM', 'Product Manager'], ['SPM', 'Senior PM']].map(([code, label]) => (
          <button key={code} onClick={() => setRole(code)}
            className={cx('rounded-md py-1.5 text-xs font-semibold transition',
              role === code ? 'bg-white text-brand-600 shadow-sm dark:bg-zinc-800 dark:text-brand-300' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')}>
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files) }}
        className={cx('flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 text-center transition',
          drag ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-300 hover:border-brand-400 hover:bg-brand-500/5 dark:border-zinc-700')}>
        <FileUp className="size-5 text-brand-500" />
        <span className="text-xs font-medium">Drop CVs or click to upload</span>
        <span className="text-[11px] text-zinc-500">PDF or DOCX · max 4 MB · applying for <b>{role === 'PM' ? 'PM' : 'Senior PM'}</b></span>
      </button>
      <input ref={input} type="file" accept=".pdf,.docx" multiple hidden
        onChange={(e) => { take(e.target.files); e.target.value = '' }} />
      {uploads.map((u) => <UploadRow key={u.key} u={u} />)}
    </div>
  )
}

function UploadRow({ u }) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (u.state !== 'running') return
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 6000)
    return () => clearInterval(t)
  }, [u.state])
  return (
    <div className="card overflow-hidden px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        {u.state === 'running' && <Loader2 className="size-3.5 shrink-0 animate-spin text-brand-500" />}
        {u.state === 'queued' && <Upload className="size-3.5 shrink-0 text-zinc-400" />}
        {u.state === 'error' && <AlertTriangle className="size-3.5 shrink-0 text-rose-500" />}
        <span className="truncate font-medium">{u.name}</span>
      </div>
      <div className={cx('mt-0.5 pl-5.5', u.state === 'error' ? 'text-rose-500' : 'text-zinc-500')}>
        {u.state === 'running' ? `${STAGES[stage]}…` : u.state === 'queued' ? 'Queued' : u.error}
      </div>
      {u.state === 'running' && <div className="shimmer -mx-3 -mb-2 mt-2 h-0.5" />}
    </div>
  )
}

export default function CandidateQueue({ candidates, selectedId, onSelect, onUpload, uploads, loading }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('score')
  const [roleFilter, setRoleFilter] = useState('all')

  const rows = useMemo(() => {
    let r = candidates.map(summarise)
    if (roleFilter !== 'all') r = r.filter((c) => c.applied_role === roleFilter)
    if (q) r = r.filter((c) => (c.name || '').toLowerCase().includes(q.toLowerCase()))
    if (sort === 'score') r.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    return r
  }, [candidates, q, sort, roleFilter])

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <UploadZone onUpload={onUpload} uploads={uploads} />
      </div>
      <div className="flex items-center gap-1.5 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="field h-8 py-0 pl-7 text-xs" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="field h-8 w-auto py-0 pl-2 pr-6 text-xs" aria-label="Filter by role">
          <option value="all">All roles</option><option value="PM">PM</option><option value="SPM">SPM</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="field h-8 w-auto py-0 pl-2 pr-6 text-xs" aria-label="Sort">
          <option value="score">Ranked</option><option value="recent">Recent</option>
        </select>
      </div>
      <div className="pane flex-1">
        {loading && <div className="p-4 text-xs text-zinc-500">Loading candidates…</div>}
        {!loading && rows.length === 0 && (
          <div className="p-6 text-center text-xs text-zinc-500">No candidates yet. Upload a CV to start.</div>
        )}
        <ul>
          {rows.map((c, i) => (
            <li key={c.id}>
              <button onClick={() => onSelect(c.id)}
                className={cx('group flex w-full items-start gap-3 border-b border-l-2 border-zinc-100 px-3 py-2.5 text-left transition dark:border-b-zinc-900',
                  selectedId === c.id ? 'border-l-brand-500 bg-brand-500/[0.07]' : 'border-l-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900')}>
                <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-[10px] text-zinc-400">{sort === 'score' ? i + 1 : ''}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{c.name || c.cv_filename}</span>
                    {c.mail?.status === 'sent' && <MailCheck className="size-3.5 shrink-0 text-emerald-500" aria-label="Email sent" />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge className="bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{c.applied_role}</Badge>
                    {c.source === 'portal' && <Badge className="bg-brand-500/10 text-brand-700 dark:text-brand-300" title="Applied through the applicant portal">Portal</Badge>}
                    {c.status === 'processing' && <Badge className="text-brand-500"><Loader2 className="size-3 animate-spin" />Scoring</Badge>}
                    {c.status === 'failed' && <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400"><AlertTriangle className="size-3" />Failed</Badge>}
                    {c.band && <BandPill band={c.band} />}
                  </div>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px] leading-5">
                  {[['PM', c.pm], ['SPM', c.spm]].map(([r, v]) => (
                    <div key={r} className={cx(r === c.applied_role ? 'font-bold' : 'opacity-60')}>
                      <span className="text-zinc-400">{r} </span>
                      <span className={scoreColor(v)}>{v != null ? v.toFixed(1) : '—'}</span>
                    </div>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden items-center gap-3 border-t border-zinc-200 px-3 py-2 text-[11px] text-zinc-500 lg:flex dark:border-zinc-800">
        <span><kbd>j</kbd>/<kbd>k</kbd> navigate</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="size-3" />{candidates.length} total</span>
      </div>
    </div>
  )
}
