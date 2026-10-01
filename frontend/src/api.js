const KEY = 'hrly-passcode'

export const passcode = {
  get() { try { return localStorage.getItem(KEY) || '' } catch { return '' } },
  set(v) { try { localStorage.setItem(KEY, v) } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(KEY) } catch { /* private mode */ } },
}

export class ApiError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields || {} }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-HRLY-Passcode': passcode.get() }
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(`/api${path}`, { method, headers, body: payload })
  if (!res.ok) {
    let msg = res.statusText
    let fields
    try {
      const j = await res.json()
      if (typeof j.detail === 'string') msg = j.detail
      else if (j.detail?.message) { msg = j.detail.message; fields = j.detail.fields }
      else msg = JSON.stringify(j.detail)
    } catch { /* not JSON */ }
    if (res.status === 504) msg = 'The server timed out. Please try again.'
    throw new ApiError(res.status, msg, fields)
  }
  return res.json()
}

export const api = {
  health: () => request('/health'),
  config: () => request('/config'),
  list: () => request('/candidates'),
  get: (id) => request(`/candidates/${id}`),
  upload: (file, role) => {
    const form = new FormData()
    form.append('file', file)
    form.append('role', role)
    return request('/candidates', { method: 'POST', form })
  },
  rescore: (id) => request(`/candidates/${id}/rescore`, { method: 'POST' }),
  update: (id, body) => request(`/candidates/${id}`, { method: 'PATCH', body }),
  remove: (id) => request(`/candidates/${id}`, { method: 'DELETE' }),
  regenerate: (id, email_type) => request(`/candidates/${id}/email/regenerate`, { method: 'POST', body: { email_type } }),
  editEmail: (id, body) => request(`/candidates/${id}/email`, { method: 'PATCH', body }),
  send: (id) => request(`/candidates/${id}/email/send`, { method: 'POST' }),
}

// Public applicant portal — no passcode.
export const publicApi = {
  config: () => request('/apply/config'),
  preview: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/apply/preview', { method: 'POST', form })
  },
  apply: (file, fields) => {
    const form = new FormData()
    form.append('file', file)
    Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)))
    return request('/apply', { method: 'POST', form })
  },
}
