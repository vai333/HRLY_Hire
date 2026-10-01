import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowRight, Briefcase, CheckCircle2, FileText, Loader2, Mail, MapPin, Phone, Sparkles, Upload, User,
} from 'lucide-react'
import { publicApi } from './api'
import { Button, cx } from './components/ui'

const ROLES = [
  {
    code: 'PM',
    title: 'Product Manager',
    band: '2–4 years of PM-equivalent experience',
    pitch: 'Be the first PM on our core platform. Spend time inside freight-forwarding ops, decide what we build, ship in short cycles, and set up the PM rhythm from scratch.',
  },
  {
    code: 'SPM',
    title: 'Senior Product Manager',
    band: '5–8 years of PM-equivalent experience',
    pitch: 'Own our integration and data layer: carrier systems, port portals and ERPs. Make the build-versus-configure calls and set the standard for how product works at Kargo.',
  },
]

const FIELDS = [
  { key: 'name', label: 'Full name', icon: User, type: 'text', autoComplete: 'name', placeholder: 'Your full name' },
  { key: 'email', label: 'Email', icon: Mail, type: 'email', autoComplete: 'email', placeholder: 'you@example.com' },
  { key: 'phone', label: 'Phone', icon: Phone, type: 'tel', autoComplete: 'tel', placeholder: '+91 98xxx xxxxx' },
]

function useSystemTheme() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
}

function Steps({ step }) {
  const labels = ['Role & resume', 'Your details', 'Done']
  return (
    <ol className="flex items-center gap-2 text-xs font-medium">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2">
          <span className={cx('grid size-6 place-items-center rounded-full text-[11px] font-bold',
            i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-500 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800')}>
            {i < step ? <CheckCircle2 className="size-3.5" /> : i + 1}
          </span>
          <span className={cx('hidden sm:inline', i === step ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500')}>{l}</span>
          {i < labels.length - 1 && <span className="h-px w-6 bg-zinc-300 sm:w-10 dark:bg-zinc-700" />}
        </li>
      ))}
    </ol>
  )
}

export default function ApplyPortal() {
  useSystemTheme()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState(null)
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [reading, setReading] = useState(false)
  const [found, setFound] = useState({})
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [consent, setConsent] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null)
  const input = useRef(null)

  useEffect(() => { document.title = 'Careers at Kargo · HRLY' }, [])

  const pickFile = (f) => {
    setError('')
    if (!f) return
    if (!/\.(pdf|docx)$/i.test(f.name)) return setError('Please upload a PDF or DOCX file.')
    if (f.size > 4 * 1024 * 1024) return setError('That file is over 4 MB. Please upload a smaller version.')
    setFile(f)
  }

  const next = async () => {
    setError('')
    setReading(true)
    try {
      const { detected } = await publicApi.preview(file)
      setFound(detected)
      setForm({ name: detected.name || '', email: detected.email || '', phone: detected.phone || '' })
      setErrors({})
      setStep(1)
    } catch (e) {
      setError(e.message)
    } finally {
      setReading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const errs = {}
    if (form.name.trim().length < 2) errs.name = 'Please enter your full name'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(form.email.trim())) errs.email = 'Please enter a valid email address'
    if (form.phone.replace(/\D/g, '').length < 10) errs.phone = 'Please enter a phone number with at least 10 digits'
    if (!consent) errs.consent = 'Please confirm to continue'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      const res = await publicApi.apply(file, { role, ...form, consent, website: honeypot })
      setDone({ ...res, email: form.email.trim() })
      setStep(2)
    } catch (e) {
      setErrors(e.fields || {})
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const missing = FIELDS.filter((f) => !found[f.key])
  const roleInfo = ROLES.find((r) => r.code === role)

  return (
    <div className="min-h-full bg-gradient-to-b from-brand-50 via-zinc-50 to-zinc-50 dark:from-brand-700/10 dark:via-zinc-950 dark:to-zinc-950">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <a href="/" className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-zinc-900 font-black text-white dark:bg-white dark:text-zinc-900">K</div>
          <div className="leading-tight">
            <div className="font-bold tracking-tight">Kargo</div>
            <div className="text-[11px] text-zinc-500">Careers</div>
          </div>
        </a>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Sparkles className="size-3.5 text-brand-500" />Hiring by <b className="font-black text-zinc-700 dark:text-zinc-300">HRLY</b>
          <span className="hidden sm:inline">· Innovative hiring</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <section className="mb-8 max-w-2xl pt-4">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Build the software that moves freight.</h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Kargo builds shipment tracking, documentation and carrier coordination software for mid-sized freight forwarders and 3PLs.
            We're a Series A team growing from 40 to 70, and we're building the product function from scratch.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><MapPin className="size-3.5" />Mumbai · in-office</span>
            <span className="flex items-center gap-1"><Briefcase className="size-3.5" />Reports to the founder</span>
          </div>
        </section>

        <div className="card mx-auto max-w-3xl p-5 shadow-xl shadow-brand-500/5 sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Apply</h2>
            <Steps step={step} />
          </div>

          {step === 0 && (
            <div className="space-y-6">
              <fieldset>
                <legend className="label mb-2">1 · Choose a role</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ROLES.map((r) => (
                    <button key={r.code} type="button" onClick={() => setRole(r.code)}
                      className={cx('rounded-xl border p-4 text-left transition',
                        role === r.code ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/30' : 'border-zinc-200 hover:border-brand-300 dark:border-zinc-800')}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{r.title}</span>
                        <span className={cx('size-4 rounded-full border-2', role === r.code ? 'border-brand-500 bg-brand-500 shadow-[inset_0_0_0_2px_white] dark:shadow-[inset_0_0_0_2px_#18181b]' : 'border-zinc-300 dark:border-zinc-600')} />
                      </div>
                      <div className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-300">{r.band}</div>
                      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">{r.pitch}</p>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <div className="label mb-2">2 · Upload your resume</div>
                <button type="button" onClick={() => input.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]) }}
                  className={cx('flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
                    drag ? 'border-brand-500 bg-brand-500/10' : file ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-zinc-300 hover:border-brand-400 dark:border-zinc-700')}>
                  {file ? (
                    <>
                      <FileText className="size-7 text-emerald-500" />
                      <span className="text-sm font-semibold">{file.name}</span>
                      <span className="text-xs text-zinc-500">{(file.size / 1024).toFixed(0)} KB · click to choose a different file</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-7 text-brand-500" />
                      <span className="text-sm font-semibold">Drag your resume here or click to browse</span>
                      <span className="text-xs text-zinc-500">PDF or DOCX, up to 4 MB</span>
                    </>
                  )}
                </button>
                <input ref={input} type="file" accept=".pdf,.docx" hidden onChange={(e) => { pickFile(e.target.files[0]); e.target.value = '' }} />
              </div>

              {error && <p className="flex items-center gap-1.5 text-sm text-rose-600 dark:text-rose-400"><AlertCircle className="size-4" />{error}</p>}

              <div className="flex justify-end">
                <Button variant="primary" size="lg" disabled={!role || !file} loading={reading} onClick={next}>
                  {reading ? 'Reading your resume…' : 'Continue'}{!reading && <ArrowRight className="size-4" />}
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <form className="space-y-5" onSubmit={submit} noValidate>
              <div className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800/60">
                Applying for <b>{roleInfo.title}</b> with <span className="font-medium">{file.name}</span>
              </div>

              {missing.length > 0 ? (
                <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    We couldn't find your <b>{missing.map((f) => f.label.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}</b> on your resume.
                    Please fill {missing.length > 1 ? 'them' : 'it'} in below.
                  </span>
                </div>
              ) : (
                <div className="flex gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />We pulled these from your resume. Please check they're right.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                {FIELDS.map(({ key, label, icon: Icon, type, autoComplete, placeholder }) => {
                  const isMissing = !found[key]
                  return (
                    <label key={key} className={cx('block', key === 'name' && 'sm:col-span-3')}>
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        <Icon className="size-3.5 text-zinc-400" />{label}<span className="text-rose-500">*</span>
                        {isMissing
                          ? <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Not on resume</span>
                          : <span className="ml-auto rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">From resume</span>}
                      </span>
                      <input
                        className={cx('field mt-1.5', errors[key] ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : isMissing && !form[key] && 'border-amber-500')}
                        type={type} autoComplete={autoComplete} placeholder={placeholder} value={form[key]}
                        autoFocus={isMissing && missing[0]?.key === key}
                        onChange={(e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((er) => ({ ...er, [key]: undefined })) }}
                      />
                      {errors[key] && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{errors[key]}</span>}
                    </label>
                  )
                })}
              </div>

              {/* Honeypot: hidden from people, filled by bots */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />

              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors((er) => ({ ...er, consent: undefined })) }}
                  className="mt-0.5 size-4 accent-brand-500" />
                <span className="text-zinc-600 dark:text-zinc-400">
                  I agree that Kargo can store and review my resume for this application. My name, contact details and college names are hidden from the automated screening.
                  {errors.consent && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{errors.consent}</span>}
                </span>
              </label>

              {error && <p className="flex items-center gap-1.5 text-sm text-rose-600 dark:text-rose-400"><AlertCircle className="size-4" />{error}</p>}

              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" onClick={() => { setStep(0); setError('') }} disabled={submitting}>
                  <ArrowLeft className="size-4" />Back
                </Button>
                <Button type="submit" variant="primary" size="lg" loading={submitting}>
                  {submitting ? 'Submitting…' : 'Submit application'}
                </Button>
              </div>
              {submitting && (
                <p className="flex items-center justify-end gap-1.5 text-xs text-zinc-500">
                  <Loader2 className="size-3 animate-spin" />This can take up to a minute. Please keep this tab open.
                </p>
              )}
            </form>
          )}

          {step === 2 && done && (
            <div className="py-6 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
              <h3 className="mt-4 text-xl font-bold">Thanks, {done.name}! Your application is in.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                We've received your application for <b>{done.role}</b>. The founder reads every application,
                and we'll email you at <b>{done.email}</b> with next steps.
              </p>
              <Button className="mt-6" variant="secondary" onClick={() => {
                setStep(0); setRole(null); setFile(null); setFound({}); setForm({ name: '', email: '', phone: '' }); setConsent(false); setDone(null)
              }}>Apply for another role</Button>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200 py-5 text-center text-xs text-zinc-500 dark:border-zinc-800">
        © Kargo · Mumbai · <a href="/" className="hover:text-brand-600 hover:underline">HRLY home</a>
      </footer>
    </div>
  )
}
