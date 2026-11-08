import { useLanguage } from '../context/LanguageContext'

export default function SupportPreferenceNote({ value }) {
  const { t } = useLanguage()
  if (!['listen', 'advice', 'reach_out', 'no_discussion'].includes(value)) return null
  return (
    <p className="mt-sm text-body-sm leading-relaxed text-on-surface-variant">
      <span className="font-semibold">{t(`support.${value}`)}</span>
      {' — '}{t(`support.${value}Hint`)}
    </p>
  )
}
