import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ApplyPortal from './ApplyPortal.jsx'
import Home from './Home.jsx'

// One site, three pages: / picks a portal, /apply is for applicants, /admin is the hiring dashboard.
const path = window.location.pathname.replace(/\/+$/, '') || '/'
const Page = path.startsWith('/admin') ? App : path.startsWith('/apply') ? ApplyPortal : Home

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
