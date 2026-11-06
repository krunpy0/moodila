import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { landingContent } from "./landingContent";
import { useTheme } from "../context/ThemeContext";
import MoodIcon from "../components/MoodIcon";
import LandingAppPreview from "../components/LandingAppPreview";
import "./Landing.css";

const MOOD_NAMES = ["awful", "bad", "meh", "good", "rad"];

function Icon({ name, className = "" }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    down: <path d="m7 10 5 5 5-5" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    phone: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4m-3 14h2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    book: <><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" /></>,
  };
  return <svg className={`lp-icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function MoodFace({ value, className = "" }) {
  return <MoodIcon mood={value + 1} className={`lp-face text-[32px] ${className}`} />;
}

function StartLink({ children, className = "" }) {
  return <Link className={`lp-button ${className}`} to="/login" state={{ mode: "register" }}>{children}<Icon name="arrow" /></Link>;
}

export default function Landing() {
  const { language, toggleLanguage } = useLanguage();
  const copy = landingContent[language] || landingContent.en;
  const { isDark, toggleTheme } = useTheme();
  return (
    <div className="lp-root" id="landing-top">
      <a className="lp-skip" href="#landing-main">{copy.skip}</a>
      <header className="lp-header lp-container">
        <a className="lp-brand" href="#landing-top" aria-label="Moodila"><img src="/favicon.png" width="36" height="36" alt="" /><span>Moodila<span className="lp-brand-dot">.</span></span></a>
        <nav className="lp-nav" aria-label={language === "ru" ? "Главная навигация" : "Main navigation"}>
          {copy.nav.map((label, i) => <a key={label} href={`#${["journal", "privacy", "questions"][i]}`}>{label}</a>)}
        </nav>
        <div className="lp-header-actions"><button type="button" className="lp-theme" aria-label={isDark ? copy.lightTheme : copy.darkTheme} title={isDark ? copy.lightTheme : copy.darkTheme} onClick={toggleTheme}><span className="material-symbols-outlined" aria-hidden="true">{isDark ? "light_mode" : "dark_mode"}</span></button><button type="button" className="lp-language" aria-label={copy.language} onClick={toggleLanguage}><Icon name="globe" /><span>{language === "ru" ? "EN" : "RU"}</span></button><Link className="lp-login" to="/login">{copy.login}<Icon name="arrow" /></Link></div>
      </header>

      <main id="landing-main">
        <section className="lp-hero lp-container" aria-labelledby="landing-title">
          <div className="lp-hero-copy">
            <h1 id="landing-title">{copy.title}<br /><span>{copy.accent}</span></h1>
            <p className="lp-intro">{copy.intro}</p>
            <div className="lp-hero-actions"><StartLink>{copy.start}</StartLink><a className="lp-text-link" href="#journal">{copy.see}<Icon name="down" /></a></div>
            <p className="lp-hero-note"><span className="lp-tiny-flower" aria-hidden="true"><Icon name="book" /></span>{copy.note}</p>
          </div>
          <figure className="lp-journal-stage"><LandingAppPreview title={copy.homePreview} /><figcaption>{copy.demo}</figcaption></figure>
        </section>

        <section className="lp-introduction lp-container lp-section" id="journal" aria-labelledby="journal-title">
          <div className="lp-section-copy"><h2 id="journal-title">{copy.previewTitle}</h2><p>{copy.previewBody}</p></div>
          <div className="lp-details">{copy.details.map(([title, text]) => <div key={title}><h3>{title}</h3><p>{text}</p></div>)}</div>
        </section>

        <section className="lp-calendar-section lp-container lp-section" aria-labelledby="calendar-title">
          <div className="lp-calendar-panel"><figure><LandingAppPreview screen="calendar" title={copy.calendarPreview} /><figcaption>{copy.demo}</figcaption></figure></div>
          <div className="lp-section-copy"><h2 id="calendar-title">{copy.calendar}</h2><p>{copy.calendarBody}</p><a className="lp-text-link" href="#questions">{copy.nav[2]}<Icon name="arrow" /></a><div className="lp-mood-spectrum" aria-hidden="true">{MOOD_NAMES.map((name, i) => <MoodFace key={name} value={i} className={`lp-mood-${name}`} />)}</div></div>
        </section>

        <section className="lp-privacy lp-container lp-section" id="privacy" aria-labelledby="privacy-title">
          <div className="lp-section-copy"><h2 id="privacy-title">{copy.privacyTitle}</h2><p>{copy.privacyBody}</p><ul className="lp-check-list">{copy.privacyPoints.map(point => <li key={point}><Icon name="check" />{point}</li>)}</ul></div>
          <div className="lp-privacy-panel"><figure><LandingAppPreview screen="privacy" title={copy.privacyPreview} /><figcaption>{copy.demo}</figcaption></figure></div>
        </section>

        <section className="lp-device lp-container" aria-labelledby="device-title"><div className="lp-device-icon"><Icon name="phone" /></div><div><h2 id="device-title">{copy.deviceTitle}</h2><p>{copy.deviceBody}</p></div><Link className="lp-text-link" to="/login">{copy.deviceLink}<Icon name="arrow" /></Link></section>

        <section className="lp-faq lp-container lp-section" id="questions" aria-labelledby="questions-title"><div className="lp-section-copy"><h2 id="questions-title">{copy.faqTitle}</h2><p>{copy.note}</p></div><div className="lp-questions">{copy.faqs.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="down" /></summary><p>{answer}</p></details>)}</div></section>

        <section className="lp-close lp-container" aria-labelledby="close-title"><div className="lp-close-faces" aria-hidden="true"><MoodFace value={2} className="lp-mood-meh" /><MoodFace value={3} className="lp-mood-good" /><MoodFace value={4} className="lp-mood-rad" /></div><h2 id="close-title">{copy.closeTitle}</h2><p>{copy.closeBody}</p><StartLink>{copy.start}</StartLink></section>
      </main>

      <footer className="lp-footer lp-container"><a className="lp-brand" href="#landing-top"><img src="/favicon.png" width="28" height="28" alt="" /><span>Moodila<span className="lp-brand-dot">.</span></span></a><p>{copy.footer}</p><a className="lp-text-link" href="#landing-top">{copy.top}<Icon name="arrow" /></a><small>© {new Date().getFullYear()} {copy.footerRights}</small></footer>
    </div>
  );
}
