import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import AppLogo from "../components/AppLogo";
import { haptics } from "../utils/haptics";

const LEGAL_CONTENT = {
  en: {
    privacy: {
      title: "Privacy Policy",
      subtitle: "How Moodila protects your personal journal and private data.",
      lastUpdated: "Last updated: October 2026",
      highlight:
        "Your privacy is non-negotiable. Moodila never sells your personal data, never tracks you across the web, and never serves third-party advertisements.",
      sections: [
        {
          title: "1. Information We Collect",
          paragraphs: [
            "We collect only what is strictly necessary to run your personal journal and friend connections:",
          ],
          bullets: [
            "Account Information: Your username, email address, and a securely salted bcrypt hash of your password.",
            "Journal Entries: Your daily mood scores (1–5), emotion tags, written notes, timestamps, and optional uploaded photos.",
            "Social Connections: Your friends list, pending friend requests, and reactions shared on friends' entries.",
            "Technical Data: Secure HttpOnly session tokens, CSRF validation tokens, and your Web Push subscription endpoint (only if you explicitly enable push reminders).",
          ],
        },
        {
          title: "2. How We Use Your Information",
          paragraphs: [
            "Your data is used solely to provide and improve the Moodila application:",
          ],
          bullets: [
            "To generate your private journal calendar, statistics, and mood trends.",
            "To deliver the social feed according to your strict, granular visibility settings.",
            "To send essential transactional notifications (password reset emails, account deletion confirmations, and opted-in push reminders).",
            "To detect security threats, mitigate spam, and enforce rate limits.",
          ],
        },
        {
          title: "3. Two-Tier Privacy & Friend Visibility",
          paragraphs: [
            "Moodila is built around strict friend privacy boundaries:",
          ],
          bullets: [
            "Private by Choice: Any journal entry can be marked as 'Only me', making it completely invisible to all friends.",
            "Custom Friend Lists: You can selectively hide specific entries from certain friends.",
            "Safe Friend Defaults: You can set new friendships to hide past and future entries by default.",
            "When a friendship is accepted, your existing custom hidden settings are strictly preserved.",
          ],
        },
        {
          title: "4. Third-Party Services & Media",
          paragraphs: [
            "We do not partner with data brokers or ad networks. We use only essential infrastructure providers:",
          ],
          bullets: [
            "S3-Compatible Cloud Storage: Encrypted at rest, used to store your entry photos.",
            "Resend: Delivers transactional emails (such as password reset requests).",
            "Sentry: Real-time application error monitoring (without logging your journal text).",
          ],
        },
        {
          title: "5. Data Retention & Account Deletion",
          paragraphs: [
            "You own your data completely. You may permanently delete your account at any time in Profile Settings.",
            "Upon confirmation, your account, journal entries, uploaded photos, and friendship records are immediately and permanently purged from our database.",
          ],
        },
        {
          title: "6. Security Safeguards",
          paragraphs: [
            "We protect your data using industry-standard engineering practices:",
          ],
          bullets: [
            "All traffic is encrypted in transit using modern TLS/HTTPS.",
            "Authentication tokens are stored in HttpOnly, SameSite cookies to protect against script injection.",
            "All state-modifying actions require cryptographically validated CSRF tokens.",
          ],
        },
        {
          title: "7. Operator & Contact Information",
          paragraphs: [
            "The data controller and operator of the Moodila service is Maksim Sergeevich Glinin (individual developer, Russian Federation).",
            "Applicable Law: Data processing complies with applicable privacy regulations, including Federal Law No. 152-FZ 'On Personal Data'. By creating an account or using the service, you provide consent to the processing of your data in accordance with this Policy.",
            "If you have questions, feedback, or wish to exercise your data protection rights, please reach out to us at support@moodila.krunpy.ru.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      subtitle: "The rules and terms governing your use of Moodila.",
      lastUpdated: "Last updated: October 2026",
      highlight:
        "Important Notice: Moodila is a self-care journal, not a medical or emergency psychiatric service. In a crisis, always contact professional healthcare or emergency responders.",
      sections: [
        {
          title: "1. Acceptance of Terms",
          paragraphs: [
            "By creating an account or using Moodila, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.",
          ],
        },
        {
          title: "2. Health & Medical Disclaimer",
          paragraphs: [
            "Moodila is designed for personal emotional awareness and daily reflection.",
            "MOODILA IS NOT A MEDICAL DEVICE, CLINICAL HEALTHCARE PROVIDER, OR EMERGENCY CRISIS HOTLINE. The app does not offer medical advice, psychiatric diagnosis, or professional treatment.",
            "If you are facing an emergency, suicidal thoughts, or emotional distress requiring urgent intervention, please reach out to your local emergency medical service or a crisis hotline immediately.",
          ],
        },
        {
          title: "3. Account Eligibility & Security",
          paragraphs: [
            "You must be at least 13 years old (or the minimum legal age in your territory) to create an account on Moodila.",
            "You are responsible for safeguarding your login credentials and for all activities that occur under your account.",
          ],
        },
        {
          title: "4. Your Content & Ownership",
          paragraphs: [
            "You retain full copyright and ownership of all content you post, including journal notes, thoughts, and photos.",
            "You grant Moodila a limited, non-exclusive license solely to host, store, and display your content to you and to friends you designate, strictly as needed to run the service.",
          ],
        },
        {
          title: "5. Prohibited Conduct",
          paragraphs: [
            "When using Moodila, you agree not to:",
          ],
          bullets: [
            "Harass, threaten, or abuse other users.",
            "Upload unlawful, malicious, or infringing content.",
            "Attempt unauthorized access to other accounts, servers, or networks.",
            "Interfere with or compromise the performance or security of the service.",
          ],
        },
        {
          title: "6. Account Termination",
          paragraphs: [
            "You may delete your account at any time through your Profile settings. We reserve the right to suspend or terminate accounts that breach these Terms or engage in abusive activities.",
          ],
        },
        {
          title: "7. Disclaimer of Warranties & Limitation of Liability",
          paragraphs: [
            "Moodila is provided on an 'AS IS' and 'AS AVAILABLE' basis without warranties of any kind.",
            "To the fullest extent permitted by law, Moodila and its operators will not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the service.",
          ],
        },
        {
          title: "8. Governing Law & Operator",
          paragraphs: [
            "These Terms and any disputes arising out of or related to Moodila are governed by the laws of the Russian Federation.",
            "The service operator is Maksim Sergeevich Glinin (individual developer). Inquiries and formal notices should be sent to support@moodila.krunpy.ru.",
          ],
        },
        {
          title: "9. Changes to Terms",
          paragraphs: [
            "We may update these Terms periodically. Continued use of Moodila following updates signifies your acceptance of the revised Terms.",
          ],
        },
      ],
    },
  },
  ru: {
    privacy: {
      title: "Политика конфиденциальности",
      subtitle: "Как Moodila защищает ваш личный дневник и персональные данные.",
      lastUpdated: "Последнее обновление: октябрь 2026",
      highlight:
        "Ваша конфиденциальность неприкосновенна. Moodila никогда не продает ваши данные, не отслеживает вас в сети и не показывает стороннюю рекламу.",
      sections: [
        {
          title: "1. Какую информацию мы собираем",
          paragraphs: [
            "Мы собираем только то, что строго необходимо для работы личного дневника и взаимодействия с друзьями:",
          ],
          bullets: [
            "Данные учетной записи: имя пользователя, адрес электронной почты и зашифрованный соленый bcrypt-хэш пароля.",
            "Записи дневника: ежедневные оценки настроения (1–5), теги эмоций, текстовые заметки, время создания и прикрепленные фотографии.",
            "Социальные связи: список друзей, входящие запросы и реакции на записи друзей.",
            "Технические данные: защищенные HttpOnly токены сессии, токены валидации CSRF и подписка на Web Push (только если вы явно включили уведомления).",
          ],
        },
        {
          title: "2. Как мы используем информацию",
          paragraphs: [
            "Ваши данные используются исключительно для обеспечения работы сервиса Moodila:",
          ],
          bullets: [
            "Для построения календаря настроения, статистики и персональной аналитики.",
            "Для формирования ленты друзей в строгом соответствии с вашими индивидуальными настройками видимости.",
            "Для отправки важных служебных сообщений (сброс пароля, подтверждение удаления аккаунта, push-напоминания).",
            "Для обнаружения угроз безопасности, защиты от спама и ограничения сетевых запросов.",
          ],
        },
        {
          title: "3. Двухуровневая приватность и видимость для друзей",
          paragraphs: [
            "Moodila спроектирована с акцентом на полный контроль приватности:",
          ],
          bullets: [
            "Личные записи: любую запись можно пометить как «Только я», и она будет скрыта от всех друзей.",
            "Кастомная видимость: вы можете выборочно скрыть определенные записи от отдельных друзей.",
            "Безопасные настройки по умолчанию: вы можете включить автоматическое скрытие записей для новых друзей.",
            "При принятии дружбы ваши индивидуальные настройки скрытия записей строго сохраняются.",
          ],
        },
        {
          title: "4. Сторонние сервисы и медиафайлы",
          paragraphs: [
            "Мы не сотрудничаем с брокерами данных или рекламными сетями. Мы используем только необходимую инфраструктуру:",
          ],
          bullets: [
            "S3-совместимое облачное хранилище: зашифровано при хранении, используется для загруженных фото.",
            "Resend: используется для отправки транзакционных писем (например, для сброса пароля).",
            "Sentry: мониторинг ошибок приложения в реальном времени (без записи текста дневников).",
          ],
        },
        {
          title: "5. Хранение данных и удаление аккаунта",
          paragraphs: [
            "Вы полностью владеете своими данными. Вы можете в любой момент безвозвратно удалить свой аккаунт в настройках профиля.",
            "После подтверждения удаления ваш аккаунт, записи дневника, фотографии и связи с друзьями удаляются навсегда из базы данных.",
          ],
        },
        {
          title: "6. Меры безопасности",
          paragraphs: [
            "Мы защищаем ваши данные с помощью современных инженерных практик:",
          ],
          bullets: [
            "Весь трафик передается по зашифрованному протоколу TLS/HTTPS.",
            "Токены авторизации хранятся в защищенных cookies с атрибутами HttpOnly и SameSite для защиты от кражи через скрипты.",
            "Все изменяющие состояние запросы защищены криптографическими CSRF-токенами.",
          ],
        },
        {
          title: "7. Оператор персональных данных и контакты",
          paragraphs: [
            "Оператором сервиса Moodila и обработки персональных данных является физическое лицо Глинин Максим Сергеевич (Российская Федерация).",
            "Применимое законодательство: Обработка данных осуществляется в соответствии с законодательством Российской Федерации, в том числе нормами Федерального закона № 152-ФЗ «О персональных данных». Создавая учетную запись или используя сервис, пользователь выражает свое добровольное согласие на обработку данных на условиях настоящей Политики.",
            "По всем вопросам защиты данных, отзыва согласия или реализации прав субъекта данных обращайтесь по адресу: support@moodila.krunpy.ru.",
          ],
        },
      ],
    },
    terms: {
      title: "Условия использования",
      subtitle: "Правила и условия, регулирующие использование сервиса Moodila.",
      lastUpdated: "Последнее обновление: октябрь 2026",
      highlight:
        "Важное предупреждение: Moodila — инструмент для самопомощи и рефлексии, а не медицинская или кризисная служба. В критической ситуации немедленно обратитесь к врачам или в службы экстренной помощи.",
      sections: [
        {
          title: "1. Принятие условий",
          paragraphs: [
            "Регистрируя учетную запись или используя Moodila, вы соглашаетесь соблюдать настоящие Условия использования. Если вы не согласны с условиями, пожалуйста, прекратите использование приложения.",
          ],
        },
        {
          title: "2. Медицинское предостережение",
          paragraphs: [
            "Moodila создана для личной осознанности и ежедневного отслеживания настроения.",
            "MOODILA НЕ ЯВЛЯЕТСЯ МЕДИЦИНСКИМ ПРИБОРОМ, КЛИНИЧЕСКИМ МЕДИЦИНСКИМ СЕРВИСОМ ИЛИ СЛУЖБОЙ ЭКСТРЕННОЙ ПОМОЩИ. Приложение не предоставляет медицинских диагнозов, лечения или психиатрической помощи.",
            "Если вы переживаете острый кризис, суицидальные мысли или вам требуется неотложная помощь, немедленно свяжитесь с профессиональной медицинской помощью или службой экстренной поддержки.",
          ],
        },
        {
          title: "3. Требования к аккаунту и безопасность",
          paragraphs: [
            "Вам должно быть не менее 13 лет (или возраста совершеннолетия в вашем регионе) для создания аккаунта в Moodila.",
            "Вы несете личную ответственность за сохранение конфиденциальности пароля и за любые действия под вашей учетной записью.",
          ],
        },
        {
          title: "4. Права на пользовательский контент",
          paragraphs: [
            "Вы сохраняете все права на создаваемый вами контент, включая записи дневника, мысли и фотографии.",
            "Вы предоставляете Moodila ограниченную неисключительную лицензию только на хранение и отображение контента вам и указанным вами друзьям, исключительно в рамках функционирования приложения.",
          ],
        },
        {
          title: "5. Запрещенное поведение",
          paragraphs: [
            "При использовании Moodila запрещается:",
          ],
          bullets: [
            "Оскорблять, преследовать или запугивать других пользователей.",
            "Загружать вредоносный или незаконный контент.",
            "Предпринимать попытки несанкционированного доступа к чужим аккаунтам, серверам или базам данных.",
            "Нарушать стабильность и безопасность работы инфраструктуры приложения.",
          ],
        },
        {
          title: "6. Удаление и блокировка аккаунта",
          paragraphs: [
            "Вы можете удалить свой аккаунт в любой момент в настройках профиля. Мы оставляем за собой право заблокировать или удалить учетную запись в случае грубого нарушения данных Условий.",
          ],
        },
        {
          title: "7. Отказ от гарантий и ограничение ответственности",
          paragraphs: [
            "Сервис Moodila предоставляется на условиях «КАК ЕСТЬ» и «ПО МЕРЕ ДОСТУПНОСТИ» без каких-либо прямых или косвенных гарантий.",
            "В максимально разрешенной законом степени администрация сервиса не несет ответственности за любой косвенный ущерб или упущенную выгоду, возникшие в результате использования сервиса.",
          ],
        },
        {
          title: "8. Применимое право и разрешение споров",
          paragraphs: [
            "Настоящие Условия и любые споры, возникающие в связи с использованием сервиса Moodila, регулируются законодательством Российской Федерации.",
            "Администратором и оператором сервиса является физическое лицо Глинин Максим Сергеевич. Официальный адрес для юридических запросов и связи: support@moodila.krunpy.ru.",
          ],
        },
        {
          title: "9. Изменения условий",
          paragraphs: [
            "Мы можем периодически вносить изменения в настоящие Условия. Продолжение использования приложения после публикации обновлений означает согласие с новой редакцией.",
          ],
        },
      ],
    },
  },
};

export default function LegalPage({ mode: initialMode = "privacy" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language, toggleLanguage } = useLanguage();

  const isTerms = location.pathname.includes("terms") || initialMode === "terms";
  const activeMode = isTerms ? "terms" : "privacy";

  const langKey = language === "ru" ? "ru" : "en";
  const doc = LEGAL_CONTENT[langKey][activeMode];

  const handleBack = () => {
    haptics.selection();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-between pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1rem))] px-container-margin">
      {/* Header bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-outline-variant/20 mb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-body-sm font-semibold text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t("legal.back")}
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>{t("legal.back")}</span>
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
          >
            <AppLogo className="w-8 h-8 rounded-xl shadow-xs shrink-0" />
            <span className="font-display text-headline-sm font-bold text-on-surface">
              Moodila
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => {
            haptics.selection();
            toggleLanguage();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-label-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title={language === "ru" ? "Switch to English" : "Переключить на русский"}
        >
          <span className="material-symbols-outlined text-[16px]">language</span>
          <span>{language.toUpperCase()}</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto flex-1 mb-12">
        {/* Toggle Pills between Privacy & Terms */}
        <nav aria-label="Legal document switcher" className="flex items-center justify-center mb-8">
          <div className="inline-flex p-1 bg-surface-container-low rounded-full border border-outline-variant/30">
            <Link
              to="/privacy"
              onClick={() => haptics.selection()}
              className={`px-5 py-2 rounded-full text-label-md font-semibold transition-all ${
                activeMode === "privacy"
                  ? "bg-surface-container-lowest text-primary shadow-subtle"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t("legal.privacyPolicy")}
            </Link>
            <Link
              to="/terms"
              onClick={() => haptics.selection()}
              className={`px-5 py-2 rounded-full text-label-md font-semibold transition-all ${
                activeMode === "terms"
                  ? "bg-surface-container-lowest text-primary shadow-subtle"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t("legal.termsOfService")}
            </Link>
          </div>
        </nav>

        {/* Document Card */}
        <article className="rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-6 sm:p-10 shadow-card">
          <div className="border-b border-outline-variant/20 pb-6 mb-8">
            <span className="inline-block px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-label-sm font-semibold mb-3">
              {doc.lastUpdated}
            </span>
            <h1 className="font-display text-headline-xl sm:text-display-sm font-bold text-on-surface leading-tight mb-2">
              {doc.title}
            </h1>
            <p className="text-body-lg text-on-surface-variant leading-relaxed">
              {doc.subtitle}
            </p>
          </div>

          {/* Highlight Callout Box */}
          <div className="p-4 sm:p-5 rounded-xl bg-primary-container/30 border border-primary/20 text-on-primary-container text-body-md font-medium leading-relaxed mb-8 flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">
              {activeMode === "privacy" ? "verified_user" : "info"}
            </span>
            <p>{doc.highlight}</p>
          </div>

          {/* Content Sections */}
          <div className="space-y-8">
            {doc.sections.map((section, idx) => (
              <section key={idx} className="space-y-3">
                <h2 className="font-display text-title-lg font-bold text-on-surface">
                  {section.title}
                </h2>
                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="text-body-md text-on-surface-variant leading-relaxed">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="space-y-2 pl-4 list-disc marker:text-primary text-body-md text-on-surface-variant leading-relaxed">
                    {section.bullets.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-label-sm text-on-surface-variant/80">
        <div className="flex items-center gap-2">
          <span>© {new Date().getFullYear()} Moodila.</span>
          <span>{t("landing.footerRights")}</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to={activeMode === "privacy" ? "/terms" : "/privacy"}
            className="hover:text-primary transition-colors font-medium underline"
          >
            {activeMode === "privacy" ? t("legal.termsOfService") : t("legal.privacyPolicy")}
          </Link>
          <span>•</span>
          <Link to="/" className="hover:text-primary transition-colors font-medium">
            {t("legal.home")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
