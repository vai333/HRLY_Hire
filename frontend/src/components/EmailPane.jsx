import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarCheck, Clock, Mail, MailCheck, MailX, Send, Sparkles } from 'lucide-react'
import { Button, Empty, cx } from './ui'

const TYPES = [
  { key: 'invite', label: 'Invite', icon: CalendarCheck, tone: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'hold', label: 'Hold', icon: Clock, tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'rejection', label: 'Reject', icon: MailX, tone: 'text-rose-600 dark:text-rose-400' },
]

function suggestion(score) {
  if (score == null) return null
  if (score >= 6.5) return { type: 'invite', why: `${score.toFixed(1)} ≥ 6.5 → invite to a 30-minute chat` }
  if (score < 5) return { type: 'rejection', why: `${score.toFixed(1)} < 5.0 → polite rejection` }
  return { type: 'hold', why: `${score.toFixed(1)} is in the Hold band (5.0–6.4) — your call` }
}

export default function EmailPane({ detail, config, onRegenerate, onSave, onSend, busy }) {
  const email = detail?.email
  const cand = detail?.candidate
  const [form, setForm] = useState({ to_email: '', subject: '', body: '' })
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [pendingType, setPendingType] = useState(null)

  useEffect(() => {
    setForm({ to_email: email?.to_email || '', subject: email?.subject || '', body: email?.draft_body || '' })
    setDirty(false); setConfirm(false); setPendingType(null)
  }, [email?.id, email?.updated_at])

  if (!detail) return <Empty icon={Mail} title="Email draft">Pick a candidate to see the drafted reply.</Empty>
  if (!email) return <Empty icon={Mail} title="No draft yet">{cand.status === 'failed' ? 'Rescore the candidate to generate one.' : 'Scoring in progress…'}</Empty>

  const sent = email.status === 'sent'
  const score = detail.evaluations?.[cand.applied_role]?.final_total
  const sug = suggestion(score != null ? Number(score) : null)
  const testSender = /resend\.dev/i.test(config?.email_from || '')
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setDirty(true); setConfirm(false) }
  const save = async () => { if (dirty) { await onSave(form); setDirty(false) } }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="label">Reply to candidate</h3>
          {sent
            ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><MailCheck className="size-3.5" />Sent</span>
            : email.status === 'failed'
              ? <span className="flex items-center gap-1 text-xs font-medium text-rose-500"><AlertTriangle className="size-3.5" />Send failed</span>
              : <span className="text-xs text-zinc-500">Draft</span>}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          {TYPES.map(({ key, label, icon: Icon, tone }) => (
            <button key={key} disabled={sent || busy === 'regenerate'}
              onClick={() => key !== email.email_type && setPendingType(key)}
              className={cx('flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed',
                email.email_type === key ? cx('bg-white shadow-sm dark:bg-zinc-800', tone) : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')}>
              <Icon className="size-3.5" />{label}
            </button>
          ))}
        </div>
        {pendingType && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-500/10 p-2 text-xs">
            <span>Rewrite as <b>{TYPES.find((t) => t.key === pendingType).label}</b>? Edits are replaced.</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPendingType(null)}>Cancel</Button>
              <Button size="sm" variant="primary" loading={busy === 'regenerate'}
                onClick={async () => { await onRegenerate(pendingType); setPendingType(null) }}><Sparkles className="size-3.5" />Rewrite</Button>
            </div>
          </div>
        )}
        {sug && (
          <p className={cx('text-[11px]', sug.type === email.email_type ? 'text-zinc-500' : 'text-amber-600 dark:text-amber-400')}>
            Rubric suggests: {sug.why}{sug.type !== email.email_type && ' (you changed it)'}
          </p>
        )}
      </div>

      <div className="pane flex flex-1 flex-col gap-3 p-4">
        <label className="block">
          <span className="label">To</span>
          <input className="field mt-1" type="email" value={form.to_email} onChange={set('to_email')} onBlur={save} disabled={sent}
            placeholder="candidate@email.com" />
          {!form.to_email && <span className="mt-1 block text-[11px] text-amber-600">No email found on the CV — add one.</span>}
        </label>
        <label className="block">
          <span className="label">Subject</span>
          <input className="field mt-1" value={form.subject} onChange={set('subject')} onBlur={save} disabled={sent} />
        </label>
        <label className="flex flex-1 flex-col">
          <span className="label">Message</span>
          <textarea className="field mt-1 min-h-72 flex-1 resize-none font-[inherit] leading-relaxed" value={form.body}
            onChange={set('body')} onBlur={save} disabled={sent} />
        </label>
        <p className="text-[11px] text-zinc-500">
          From <span className="font-mono">{config?.email_from || '…'}</span>{dirty ? ' · unsaved' : ' · saved'}
        </p>
        {testSender && !sent && (
          <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
            Test sender: Resend only delivers <span className="font-mono">onboarding@resend.dev</span> mail to your own Resend account address. Verify a domain and set EMAIL_FROM to reach candidates.
          </p>
        )}
        {email.status === 'failed' && email.error && <p className="text-[11px] text-rose-500">{email.error}</p>}
      </div>

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        {sent ? (
          <div className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-1.5 font-semibold"><MailCheck className="size-4" />Sent to {email.to_email}</div>
            <div className="mt-1 opacity-80">{new Date(email.sent_at).toLocaleString()} · Resend id <span className="font-mono">{email.resend_id}</span></div>
          </div>
        ) : confirm ? (
          <div className="space-y-2">
            <p className="text-center text-xs">Send this <b>{email.email_type}</b> to <b>{form.to_email}</b>?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" onClick={() => setConfirm(false)}>Cancel</Button>
              <Button variant="success" size="lg" loading={busy === 'send'} onClick={async () => { await save(); await onSend(); setConfirm(false) }}>
                <Send className="size-4" />Confirm send
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="primary" size="lg" className="w-full" disabled={!form.to_email || !form.body} onClick={() => setConfirm(true)}>
            <Send className="size-4" />Send via Resend
          </Button>
        )}
      </div>
    </div>
  )
}
