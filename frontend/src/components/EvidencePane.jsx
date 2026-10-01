import { useEffect, useState } from 'react'
import {
  AlertTriangle, BadgeCheck, Check, Copy, ExternalLink, EyeOff, FileText, Flag, Mail, MapPin, Phone, RefreshCw, ShieldCheck, Trash2, TriangleAlert,
} from 'lucide-react'
import { Badge, BandPill, Button, Empty, LevelDots, Section, cx, scoreColor } from './ui'

const ROLE_NAME = { PM: 'Product Manager', SPM: 'Senior Product Manager' }
const PII_LABELS = {
  name_mentions: 'name mentions', emails: 'emails', phones: 'phones', links: 'links',
  addresses: 'addresses', institutions: 'colleges', personal_details: 'personal details',
}

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <Button size="sm" variant="ghost" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })
    }}>
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{done ? 'Copied' : label}
    </Button>
  )
}

function Criterion({ c }) {
  const [open, setOpen] = useState(c.level <= 2)
  return (
    <div className="border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-800/70">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className="w-7 shrink-0 font-mono text-xs font-bold text-zinc-400">{c.id}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
        <Badge className="hidden bg-zinc-100 font-mono text-zinc-500 sm:inline-flex dark:bg-zinc-800" title="Evidence rung">{c.evidence_rung}</Badge>
        <LevelDots level={c.level} />
        <span className="w-16 shrink-0 text-right font-mono text-xs">
          <b>{c.points.toFixed(2)}</b><span className="text-zinc-400">/{c.weight.toFixed(1)}</span>
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 pl-10">
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400">{c.rationale}</p>
          {c.quote_checks?.length > 0 ? c.quote_checks.map((q, i) => (
            <blockquote key={i} className={cx('border-l-2 py-0.5 pl-3 text-[13px] italic',
              q.verified ? 'border-brand-400 text-zinc-700 dark:text-zinc-300' : 'border-amber-500 text-zinc-600 dark:text-zinc-400')}>
              “{q.quote}”
              {!q.verified && (
                <span className="ml-2 inline-flex items-center gap-1 not-italic text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="size-3" />not found verbatim in CV
                </span>
              )}
            </blockquote>
          )) : <p className="text-xs text-zinc-500">No quotable evidence on the CV.</p>}
          {c.adjustments?.map((a, i) => (
            <p key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3" />{a}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function FlagChip({ label, value, icon: Icon }) {
  const v = (value || '').toLowerCase()
  const warn = /unclear|below|above|human review|yes|check/.test(v)
  return (
    <div className={cx('rounded-lg border px-2.5 py-2', warn ? 'border-amber-500/40 bg-amber-500/5' : 'border-zinc-200 dark:border-zinc-800')}>
      <div className="flex items-center gap-1.5 label"><Icon className="size-3" />{label}</div>
      <div className="mt-1 text-xs leading-snug">{value || '—'}</div>
    </div>
  )
}

export default function EvidencePane({ detail, onRescore, onDelete, busy }) {
  const cand = detail?.candidate
  const [tab, setTab] = useState(cand?.applied_role || 'PM')
  const [showRaw, setShowRaw] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => { setTab(cand?.applied_role || 'PM'); setShowRaw(false); setConfirmDelete(false) }, [cand?.id, cand?.applied_role])

  if (!detail) return <Empty icon={FileText} title="Select a candidate">The interview brief, evidence and scorecard appear here.</Empty>

  const ev = detail.evaluations?.[tab]
  const evs = detail.evaluations || {}
  const pii = cand.pii_report || {}
  const removed = Object.entries(pii).filter(([, n]) => n > 0)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight">{cand.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>Applied: <b className="text-zinc-700 dark:text-zinc-300">{ROLE_NAME[cand.applied_role]}</b></span>
            {cand.city && <span className="flex items-center gap-1"><MapPin className="size-3" />{cand.city}</span>}
            {cand.email && <a href={`mailto:${cand.email}`} className="flex items-center gap-1 hover:underline"><Mail className="size-3" />{cand.email}</a>}
            {cand.phone && <a href={`tel:${cand.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1 hover:underline"><Phone className="size-3" />{cand.phone}</a>}
            {cand.source === 'portal' && <span className="rounded bg-brand-500/10 px-1.5 py-0.5 font-medium text-brand-700 dark:text-brand-300">Applied via portal</span>}
            {detail.cv_url && (
              <a href={detail.cv_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-300">
                <ExternalLink className="size-3" />{cand.cv_filename}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" onClick={onRescore} loading={busy === 'rescore'}><RefreshCw className="size-3.5" />Rescore</Button>
          {confirmDelete
            ? <Button size="sm" variant="danger" onClick={onDelete} loading={busy === 'delete'}>Confirm delete</Button>
            : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete candidate"><Trash2 className="size-3.5" /></Button>}
        </div>
      </div>

      {cand.status === 'failed' && (
        <div className="flex gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div><b>Processing failed.</b> {cand.error} — try Rescore.</div>
        </div>
      )}

      {/* Dual-score tabs */}
      <div className="grid grid-cols-2 gap-2">
        {['PM', 'SPM'].map((r) => {
          const e = evs[r]
          return (
            <button key={r} onClick={() => setTab(r)}
              className={cx('card p-3 text-left transition', tab === r ? 'ring-2 ring-brand-500' : 'opacity-75 hover:opacity-100')}>
              <div className="flex items-center justify-between gap-2">
                <span className="label">{r === 'PM' ? 'PM rubric' : 'Senior PM rubric'}</span>
                {cand.applied_role === r && <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">APPLIED</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <div className={cx('font-mono text-3xl font-bold leading-none', scoreColor(e?.final_total))}>
                  {e ? Number(e.final_total).toFixed(1) : '—'}<span className="text-sm font-medium text-zinc-400">/10</span>
                </div>
                {e ? <BandPill band={e.recommendation} /> : <span className="text-xs text-zinc-500">Not scored</span>}
              </div>
            </button>
          )
        })}
      </div>

      {ev && (
        <>
          {/* Verdict */}
          <Section title="Interview brief" right={<CopyButton label="Copy brief" text={briefText(cand, ev)} />}>
            <ul className="space-y-1.5">
              {ev.summary?.map((s, i) => <li key={i} className="flex gap-2 text-sm"><span className="text-brand-500">▸</span>{s}</li>)}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
              <Badge className="bg-zinc-100 dark:bg-zinc-800">Raw {Number(ev.raw_total).toFixed(1)}</Badge>
              <Badge className="bg-zinc-100 dark:bg-zinc-800">Final {Number(ev.final_total).toFixed(1)}</Badge>
              <Badge className="bg-zinc-100 dark:bg-zinc-800">{ev.total_years} yrs total</Badge>
              <Badge className="bg-brand-500/10 text-brand-700 dark:text-brand-300">{ev.pm_equivalent_years} PM-equivalent yrs</Badge>
              {ev.unverified_quotes > 0 && (
                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300"><TriangleAlert className="size-3" />{ev.unverified_quotes} unverified quote{ev.unverified_quotes > 1 ? 's' : ''}</Badge>
              )}
            </div>
            {ev.caps_applied?.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg bg-amber-500/10 p-2.5">
                {ev.caps_applied.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3.5" />Cap: {c}</div>
                ))}
              </div>
            )}
          </Section>

          {/* Probes */}
          <Section title="3 interview probes" right={<CopyButton text={ev.interview_probes.map((p, i) => `${i + 1}. ${p}`).join('\n')} />}>
            <ol className="space-y-2.5">
              {ev.interview_probes.map((p, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-500 font-mono text-[11px] font-bold text-white">{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </Section>

          {/* Scorecard */}
          <Section title={`Scorecard · ${ev.role}`} right={<span className="font-mono text-xs text-zinc-500">points = weight × level ÷ 4</span>}>
            {ev.criteria.map((c) => <Criterion key={c.id} c={c} />)}
          </Section>

          {/* Flags */}
          <Section title="Flags (reported, not scored)">
            <div className="grid grid-cols-2 gap-2">
              <FlagChip label="Location" value={ev.flags.location} icon={MapPin} />
              <FlagChip label="Band" value={ev.flags.band} icon={Flag} />
              <FlagChip label="Credibility" value={ev.flags.credibility} icon={BadgeCheck} />
              <FlagChip label="Career switch" value={ev.flags.career_switch} icon={RefreshCw} />
            </div>
          </Section>

          {/* Strengths / gaps */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="Top strengths">
              <ul className="space-y-1.5 text-sm">{ev.top_strengths.map((s, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />{s}</li>)}</ul>
            </Section>
            <Section title="Gaps">
              <ul className="space-y-1.5 text-sm">{ev.gaps.map((s, i) => <li key={i} className="flex gap-2"><span className="mt-0.5 text-amber-500">?</span>{s}</li>)}</ul>
            </Section>
          </div>

          {/* Timeline */}
          <Section title="Timeline">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead className="text-[11px] text-zinc-500">
                  <tr><th className="px-1 pb-2 font-medium">Employer</th><th className="px-1 pb-2 font-medium">Title</th><th className="px-1 pb-2 font-medium">Dates</th><th className="px-1 pb-2 font-medium">Stage / size</th><th className="px-1 pb-2 font-medium">PM-eq.</th></tr>
                </thead>
                <tbody>
                  {ev.timeline.map((t, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-1 py-1.5 font-medium">{t.employer}</td>
                      <td className="px-1 py-1.5">{t.title}</td>
                      <td className="whitespace-nowrap px-1 py-1.5 text-zinc-500">{t.dates}</td>
                      <td className="px-1 py-1.5 text-zinc-500">{t.stage_size}</td>
                      <td className="px-1 py-1.5">{t.pm_equivalent ? <Check className="size-4 text-emerald-500" /> : <span className="text-zinc-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      {/* PII shield */}
      <Section title="PII shield" right={
        <Button size="sm" variant="ghost" onClick={() => setShowRaw((s) => !s)}><EyeOff className="size-3.5" />{showRaw ? 'Hide' : 'What the AI saw'}</Button>
      }>
        <div className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          <span>
            Removed before scoring: {removed.length ? removed.map(([k, n]) => `${n} ${PII_LABELS[k] || k}`).join(' · ') : 'nothing detected'}.
            Name, contact details, address, colleges and protected attributes never reach the model.
          </span>
        </div>
        {showRaw && (
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 font-mono text-[11px] leading-relaxed dark:bg-zinc-950">{cand.redacted_text}</pre>
        )}
      </Section>
      {ev && <p className="pb-4 text-center text-[11px] text-zinc-400">Scored by {ev.model} at temperature 0{ev.scoring_mode ? ` · ${ev.scoring_mode} mode` : ''} · totals and caps computed by HRLY from the Kargo rubric</p>}
    </div>
  )
}

function briefText(cand, ev) {
  return [
    `${cand.name} — ${ev.role}: ${Number(ev.final_total).toFixed(1)}/10 (${ev.recommendation})`,
    ...ev.summary,
    '',
    ev.caps_applied?.length ? `Caps: ${ev.caps_applied.join('; ')}` : null,
    'Scorecard:',
    ...ev.criteria.map((c) => `  ${c.id} ${c.name}: L${c.level} (${c.points.toFixed(2)}/${c.weight}) — ${c.rationale}`),
    '',
    'Probes:',
    ...ev.interview_probes.map((p, i) => `  ${i + 1}. ${p}`),
  ].filter((x) => x !== null).join('\n')
}
