import i18n from 'i18next'
import Backend from 'i18next-http-backend'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { initReactI18next } from 'react-i18next'
import Modal from 'react-modal'
import App from './App'
import { createClient } from './api/client'
import './index.css'
import './components.css'
import LanguageDetector from 'i18next-browser-languagedetector'
import { GlobalErrorBoundary } from './components/error-boundary.tsx'
import { endpoint, oauth_url } from './config'
import { listenSystemMode } from './utils/darkModeUtils'
export { endpoint, oauth_url }
export const client = createClient(endpoint)
listenSystemMode()
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    // the translations
    // (tip move them in a JSON file and import them,
    // or even better, manage them via a UI: https://react.i18next.com/guides/multiple-translation-files#manage-your-translations-with-a-management-gui)
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    },
  })
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
)
Modal.setAppElement('#root')
