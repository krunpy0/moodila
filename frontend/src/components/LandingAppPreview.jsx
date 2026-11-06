import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

export default function LandingAppPreview({ screen = "home", title }) {
  const frame = useRef(null);
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [src] = useState(() => `/landing-preview.html?${new URLSearchParams({ screen, language, theme })}`);
  const synchronize = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "moodila-preview-settings", language, theme }, window.location.origin);
  }, [language, theme]);
  useEffect(() => {
    synchronize();
    const ready = (event) => {
      if (event.source === frame.current?.contentWindow && event.origin === window.location.origin && event.data?.type === "moodila-preview-ready") synchronize();
    };
    window.addEventListener("message", ready);
    return () => window.removeEventListener("message", ready);
  }, [synchronize]);
  return <iframe ref={frame} src={src} title={title} className={`lp-app-preview lp-app-preview-${screen}`} loading={screen === "home" ? "eager" : "lazy"} sandbox="allow-scripts allow-same-origin" allow="camera 'none'; microphone 'none'; geolocation 'none'" onLoad={synchronize} />;
}
