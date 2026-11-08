import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LanguageProvider, useLanguage } from "../context/LanguageContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { NotificationsProvider } from "../components/Notifications";
import { THEMES } from "../utils/themes";
import Home from "../pages/Home";
import Calendar from "../pages/Calendar";
import EntrySearch from "../pages/EntrySearch";
import AddEntry from "../pages/AddEntry";
import Feed from "../pages/Feed";
import Profile from "../pages/Profile";

const params = new URLSearchParams(window.location.search);
const screen = params.get("screen");
const start = screen === "calendar" ? "/calendar" : screen === "privacy" ? "/entries/new" : "/home";

function PreviewBridge() {
  const { setTheme } = useTheme();
  const { setLanguage } = useLanguage();
  const { pathname } = useLocation();
  useEffect(() => {
    const apply = ({ theme, language }) => {
      if (THEMES.some(item => item.id === theme)) setTheme(theme);
      if (language === "ru" || language === "en") setLanguage(language);
    };
    apply({ theme: params.get("theme"), language: params.get("language") });
    const receive = (event) => {
      if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.type !== "moodila-preview-settings") return;
      apply(event.data);
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "moodila-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, [setTheme, setLanguage]);
  useEffect(() => {
    if (screen !== "privacy" || pathname !== "/entries/new") return;
    // Reveal the actual privacy section after the real entry page finishes loading.
    let active = true;
    const observer = new MutationObserver(() => {
      const control = document.querySelector('[role="switch"]');
      if (!control) return;
      const section = control.closest("section");
      observer.disconnect();
      document.fonts.ready.then(() => {
        if (active) window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - 24 });
      });
    });
    observer.observe(document.getElementById("root"), { childList: true, subtree: true });
    return () => { active = false; observer.disconnect(); };
  }, [pathname]);
  return null;
}

export default function PreviewApp({ client }) {
  return <QueryClientProvider client={client}>
    <LanguageProvider persist={false}>
      <ThemeProvider persist={false}>
        <NotificationsProvider>
          <MemoryRouter initialEntries={[start]}>
            <PreviewBridge />
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/entries/search" element={<EntrySearch />} />
              <Route path="/entries/new" element={<AddEntry />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </MemoryRouter>
        </NotificationsProvider>
      </ThemeProvider>
    </LanguageProvider>
  </QueryClientProvider>;
}
