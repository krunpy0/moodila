import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import AppLogo from "../components/AppLogo";
import { safeNavigateBack } from "../utils/navigation";
import { haptics } from "../utils/haptics";

const LEGAL_DOCS = {
  en: {
    privacy: {
      title: "Privacy Policy",
      subtitle:
        "How Moodila safeguards your daily mood reflections, personal entries, and friend privacy boundaries.",
      lastUpdated: "October 2026",
      readTime: "4 min read",
      operator: "Maksim S. Glinin, Operator",
      principlesTitle: "Our Privacy Commitments at a Glance",
      principles: [
        {
          icon: "lock",
          title: "Zero Ads & Zero Tracking",
          desc: "We never sell your data, never use cross-site trackers, and never serve ads. Your thoughts remain strictly yours.",
        },
        {
          icon: "tune",
          title: "Two-Tier Friend Visibility",
          desc: "Make any entry completely private or hide it selectively per friend. New friendships never expose your hidden past.",
        },
        {
          icon: "delete_forever",
          title: "Instant, Permanent Purge",
          desc: "Delete your account at any time in Profile Settings. All entries, photos, and records are erased immediately and irreversibly.",
        },
      ],
      sections: [
        {
          id: "collection",
          number: "01",
          title: "Information We Collect",
          lead: "We operate on a strict data-minimization principle. We collect only what is necessary to run your personal journal and your opted-in social circles:",
          items: [
            {
              label: "Account Information",
              text: "Your username, email address, and a securely salted bcrypt hash of your password. We never store plain-text passwords.",
            },
            {
              label: "Journal Entries",
              text: "Daily mood scores (1–5), emotional tag selections, written reflections, timestamp markers, and optional attached photographs.",
            },
            {
              label: "Social Connections",
              text: "Your approved friends list, pending friend requests, and reactions you leave on entries shared by friends.",
            },
            {
              label: "Technical & Session Data",
              text: "Secure HttpOnly session tokens, CSRF tokens, and Web Push subscription endpoints (only when push notifications are explicitly enabled).",
            },
          ],
        },
        {
          id: "usage",
          number: "02",
          title: "How We Use Your Information",
          lead: "Your information is used solely to power the core capabilities of the Moodila platform:",
          items: [
            {
              label: "Journaling & Analytics",
              text: "To construct your personal monthly calendar, calculate emotional trends, and produce self-care insights.",
            },
            {
              label: "Friend Feed Delivery",
              text: "To display entries to friends strictly adhering to your granular, per-entry and per-friend visibility settings.",
            },
            {
              label: "Essential Communications",
              text: "To send transactional emails (password reset, account deletion confirmation) and scheduled push reminders you opted into.",
            },
            {
              label: "Platform Integrity",
              text: "To mitigate brute-force attempts, prevent spam, enforce rate limits, and protect user security.",
            },
          ],
        },
        {
          id: "privacy-model",
          number: "03",
          title: "Two-Tier Privacy & Friend Visibility",
          lead: "Emotional journaling requires emotional safety. Moodila features a dedicated privacy engine designed to prevent accidental exposure:",
          items: [
            {
              label: "Private by Default Choice",
              text: "Any entry can be designated as 'Only me', hiding it entirely from everyone on your friends list.",
            },
            {
              label: "Granular Friend Lists",
              text: "You can choose specific friends to exclude from viewing individual entries or set default exclusions.",
            },
            {
              label: "Safe Defaults for New Friends",
              text: "When accepting a new friendship, your existing private and customized entry settings are strictly preserved. Historical private entries remain protected.",
            },
          ],
        },
        {
          id: "infrastructure",
          number: "04",
          title: "Third-Party Services & Storage",
          lead: "We do not sell data to data brokers or monetize user attention. We rely only on essential, privacy-compliant infrastructure providers:",
          items: [
            {
              label: "S3-Compatible Cloud Storage",
              text: "Encrypted at rest, used exclusively to store journal entry photos you choose to upload.",
            },
            {
              label: "Resend",
              text: "Delivers essential transactional emails such as password reset tokens and security notifications.",
            },
            {
              label: "Sentry",
              text: "Monitors application errors and runtime crashes without logging the contents of your private journal text.",
            },
          ],
        },
        {
          id: "retention",
          number: "05",
          title: "Data Retention & Permanent Deletion",
          lead: "You retain unconditional ownership over your diary. When you decide to leave, we do not hold your data hostage:",
          paragraphs: [
            "You can permanently delete your account at any moment through Profile Settings.",
            "Upon two-step confirmation, your user profile, journal entries, photos, reactions, and friend links are permanently wiped from PostgreSQL storage and media disks.",
            "We do not retain shadow copies, training archives, or unlinked remnants of your journal after deletion.",
          ],
        },
        {
          id: "security",
          number: "06",
          title: "Engineering Security Safeguards",
          lead: "We implement defense-in-depth security engineering to protect your reflections from unauthorized inspection:",
          items: [
            {
              label: "Encrypted in Transit",
              text: "All traffic between your browser and our servers is secured with TLS 1.3 encryption.",
            },
            {
              label: "HttpOnly & SameSite Cookies",
              text: "Authentication tokens cannot be read by third-party browser scripts, neutralizing Cross-Site Scripting (XSS) token theft.",
            },
            {
              label: "Cryptographic CSRF Tokens",
              text: "All mutating requests (POST, PUT, DELETE) require a cryptographically verified anti-CSRF token.",
            },
          ],
        },
        {
          id: "operator",
          number: "07",
          title: "Operator & Legal Information",
          lead: "Moodila is operated with full transparency and compliance with applicable data protection regulations:",
          paragraphs: [
            "The data controller and service operator is Maksim Sergeevich Glinin (individual developer, Russian Federation).",
            "Data processing complies with applicable privacy regulations, including Federal Law No. 152-FZ 'On Personal Data'. By registering an account or continuing to use Moodila, you consent to the processing of your data under the terms of this Policy.",
            "For all inquiries, formal requests, or requests to exercise data protection rights, please contact the operator directly at support@moodila.krunpy.ru.",
          ],
          callout: {
            type: "operator",
            title: "Data Controller Details",
            operatorName: "Maksim Sergeevich Glinin",
            legalFramework: "Federal Law No. 152-FZ 'On Personal Data'",
            contactEmail: "support@moodila.krunpy.ru",
          },
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      subtitle:
        "The clear, mutual agreement and rules governing your use of the Moodila platform and services.",
      lastUpdated: "October 2026",
      readTime: "4 min read",
      operator: "Maksim S. Glinin, Operator",
      principlesTitle: "Our Terms at a Glance",
      principles: [
        {
          icon: "health_and_safety",
          title: "Self-Care, Not Healthcare",
          desc: "Moodila is a personal reflection diary, not a medical clinic or emergency service. In a crisis, always contact professional healthcare.",
        },
        {
          icon: "edit_note",
          title: "You Own Your Words",
          desc: "You retain 100% copyright and ownership over your journal entries, thoughts, and photos. We never claim ownership.",
        },
        {
          icon: "handshake",
          title: "A Respectful Space",
          desc: "Zero tolerance for harassment, malicious content, or security attacks. Respect other journal keepers.",
        },
      ],
      sections: [
        {
          id: "acceptance",
          number: "01",
          title: "Acceptance of Terms",
          lead: "By creating an account, installing the Moodila PWA, or accessing the service, you agree to comply with and be bound by these Terms of Service. If you do not agree, please do not use the service.",
        },
        {
          id: "medical-disclaimer",
          number: "02",
          title: "Health & Medical Disclaimer",
          lead: "Moodila is created solely for personal mindfulness, emotional journaling, and self-reflection.",
          paragraphs: [
            "MOODILA IS NOT A MEDICAL DEVICE, CLINICAL HEALTHCARE PROVIDER, OR EMERGENCY CRISIS HOTLINE. The application does not provide clinical diagnoses, psychiatric treatment, or psychological therapy.",
            "Information recorded in the application does not substitute for consultation with licensed medical practitioners or mental health professionals.",
            "If you or someone you know is in crisis, dealing with thoughts of self-harm, or experiencing an emergency, please contact your local emergency services or a dedicated mental health crisis hotline immediately.",
          ],
          callout: {
            type: "warning",
            title: "Important Medical Notice",
            text: "Moodila is a self-care journal. It does not provide medical advice or crisis intervention. In an emergency, always contact emergency medical responders.",
          },
        },
        {
          id: "eligibility",
          number: "03",
          title: "Account Eligibility & Security",
          lead: "To maintain a safe and responsible environment, account creation is subject to standard age and security requirements:",
          items: [
            {
              label: "Age Requirement",
              text: "You must be at least 13 years of age (or the legal age of digital consent in your jurisdiction) to register an account.",
            },
            {
              label: "Credential Confidentiality",
              text: "You are solely responsible for maintaining the confidentiality of your login credentials and for any activity that occurs under your account.",
            },
            {
              label: "Prompt Notification",
              text: "You agree to notify us immediately at support@moodila.krunpy.ru if you discover any unauthorized access to your account.",
            },
          ],
        },
        {
          id: "content-rights",
          number: "04",
          title: "Your Content & Ownership",
          lead: "Your thoughts and words belong to you. We respect your intellectual property:",
          paragraphs: [
            "You retain full intellectual property ownership and copyright over all text, mood entries, thoughts, and photographs you publish in Moodila.",
            "You grant Moodila a limited, non-exclusive, revocable license strictly to host, transmit, and display your content to you and to friends you designate in your visibility settings.",
            "This license terminates immediately when you delete content or remove your account.",
          ],
        },
        {
          id: "conduct",
          number: "05",
          title: "Prohibited Conduct",
          lead: "To preserve a calm, safe atmosphere for self-reflection, the following behaviors are strictly prohibited:",
          items: [
            {
              label: "Harassment & Hate",
              text: "Stalking, threatening, bullying, or harassing other users through reactions, usernames, or shared notes.",
            },
            {
              label: "Unlawful Content",
              text: "Uploading defamatory, abusive, infringing, or illegal material.",
            },
            {
              label: "Security Breaches",
              text: "Attempting to reverse-engineer, exploit vulnerabilities, probe rate limits, or gain unauthorized access to other accounts or databases.",
            },
            {
              label: "Automated Scraping",
              text: "Deploying automated crawlers or scrapers without express written authorization.",
            },
          ],
        },
        {
          id: "termination",
          number: "06",
          title: "Account Termination & Suspension",
          lead: "You hold the right to discontinue your use of Moodila at any moment:",
          paragraphs: [
            "You may delete your account at any time in Profile Settings, resulting in complete erasure of your data.",
            "We reserve the right to suspend or terminate access for accounts that repeatedly or severely violate these Terms or threaten the safety of others.",
          ],
        },
        {
          id: "warranties",
          number: "07",
          title: "Disclaimer of Warranties & Liability",
          lead: "Legal limitations governing the software service:",
          paragraphs: [
            "Moodila is provided on an 'AS IS' and 'AS AVAILABLE' basis, without express or implied warranties of any kind.",
            "To the fullest extent permitted by applicable law, the operator shall not be liable for any indirect, incidental, or consequential damages resulting from the use of or inability to use the service.",
          ],
        },
        {
          id: "governing-law",
          number: "08",
          title: "Governing Law & Operator Information",
          lead: "Legal jurisdiction and formal operator details:",
          paragraphs: [
            "These Terms and any disputes arising out of or related to Moodila are governed by the laws of the Russian Federation.",
            "The service operator is Maksim Sergeevich Glinin (individual developer, Russian Federation). Legal notices and inquiries should be directed to support@moodila.krunpy.ru.",
          ],
          callout: {
            type: "operator",
            title: "Operator Information",
            operatorName: "Maksim Sergeevich Glinin",
            legalFramework: "Governed by the laws of the Russian Federation",
            contactEmail: "support@moodila.krunpy.ru",
          },
        },
        {
          id: "changes",
          number: "09",
          title: "Modifications to Terms",
          lead: "We may update these Terms periodically to reflect product improvements or statutory changes:",
          paragraphs: [
            "Substantial modifications will be highlighted through in-app announcements or notification banners.",
            "Continued use of Moodila following the publication of revised Terms constitutes acceptance of the changes.",
          ],
        },
      ],
    },
  },
  ru: {
    privacy: {
      title: "Политика конфиденциальности",
      subtitle:
        "Как Moodila защищает ваши ежедневные размышления, личные записи и границы приватности среди друзей.",
      lastUpdated: "Октябрь 2026",
      readTime: "4 мин. чтения",
      operator: "Оператор: М. С. Глинин",
      principlesTitle: "Ключевые принципы приватности",
      principles: [
        {
          icon: "lock",
          title: "Никакой рекламы и трекеров",
          desc: "Мы никогда не продаем ваши данные, не используем сторонние трекеры и не показываем рекламу. Ваши мысли остаются только вашими.",
        },
        {
          icon: "tune",
          title: "Двухуровневый контроль",
          desc: "Скрывайте записи от всех или выборочно от отдельных друзей. Новые друзья никогда не увидят ваши скрытые прошлые записи.",
        },
        {
          icon: "delete_forever",
          title: "Безвозвратное удаление",
          desc: "Удаляйте аккаунт в любой момент в настройках профиля. Все записи, фото и связи стираются навсегда и безвозвратно.",
        },
      ],
      sections: [
        {
          id: "collection",
          number: "01",
          title: "Какую информацию мы собираем",
          lead: "Мы следуем принципу строгой минимизации данных. Мы собираем только то, что необходимо для ведения личного дневника и общения с друзьями:",
          items: [
            {
              label: "Данные учетной записи",
              text: "Имя пользователя, адрес электронной почты и зашифрованный соленый bcrypt-хэш пароля. Пароли в открытом виде никогда не сохраняются.",
            },
            {
              label: "Записи дневника",
              text: "Ежедневные оценки настроения (1–5), теги эмоций, текстовые заметки, метки времени и прикрепленные фотографии.",
            },
            {
              label: "Социальные связи",
              text: "Список подтвержденных друзей, входящие запросы и реакции, оставленные на записи друзей.",
            },
            {
              label: "Технические параметры",
              text: "Защищенные токены сессии в HttpOnly Cookies, CSRF-токены и подписка на Web Push (только если вы явно включили уведомления).",
            },
          ],
        },
        {
          id: "usage",
          number: "02",
          title: "Как мы используем информацию",
          lead: "Данные используются исключительно для обеспечения функционирования сервиса Moodila:",
          items: [
            {
              label: "Дневник и аналитика",
              text: "Для формирования персонального календаря, расчета эмоциональных трендов и отображения персональной статистики.",
            },
            {
              label: "Лента друзей",
              text: "Для показа записей друзьям в строгом соответствии с вашими индивидуальными настройками приватности.",
            },
            {
              label: "Служебные уведомления",
              text: "Для отправки важных системных писем (сброс пароля, подтверждение удаления аккаунта) и настроенных push-напоминаний.",
            },
            {
              label: "Безопасность платформы",
              text: "Для обнаружения попыток несанкционированного доступа, защиты от спама и ограничения частоты сетевых запросов.",
            },
          ],
        },
        {
          id: "privacy-model",
          number: "03",
          title: "Двухуровневая приватность и видимость для друзей",
          lead: "Эмоциональный дневник требует доверия и безопасности. Архитектура Moodila предотвращает случайную утечку личных мыслей:",
          items: [
            {
              label: "Личные записи («Только я»)",
              text: "Любую запись можно пометить как личную — она станет полностью невидимой для всех друзей.",
            },
            {
              label: "Выборочное скрытие",
              text: "Вы можете скрыть конкретные записи от отдельных пользователей в вашем списке друзей.",
            },
            {
              label: "Безопасность при добавлении друзей",
              text: "При принятии новой дружбы все ваши исторические настройки скрытых записей строго сохраняются. Новый друг не получит доступ к скрытому прошлому.",
            },
          ],
        },
        {
          id: "infrastructure",
          number: "04",
          title: "Сторонние сервисы и инфраструктура",
          lead: "Мы не сотрудничаем с брокерами данных или рекламными сетями. Мы используем только надежную базовую инфраструктуру:",
          items: [
            {
              label: "S3-совместимое облако",
              text: "Зашифровано при хранении, используется исключительно для хранения загруженных фотографий дня.",
            },
            {
              label: "Resend",
              text: "Обеспечивает надежную доставку служебных писем (например, для сброса пароля).",
            },
            {
              label: "Sentry",
              text: "Мониторинг ошибок и сбоев приложения в реальном времени без сбора текста ваших дневников.",
            },
          ],
        },
        {
          id: "retention",
          number: "05",
          title: "Хранение данных и удаление аккаунта",
          lead: "Вы полностью контролируете свои данные. Если вы решите уйти, мы не удерживаем ваши записи:",
          paragraphs: [
            "Вы можете в любой момент безвозвратно удалить свой аккаунт через настройки профиля.",
            "После двухэтапного подтверждения аккаунт, дневниковые записи, фотографии, реакции и связи с друзьями удаляются навсегда из базы данных PostgreSQL и медиахранилища.",
            "Мы не сохраняем теневые копии и не используем ваши личные записи для обучения нейросетей после удаления.",
          ],
        },
        {
          id: "security",
          number: "06",
          title: "Инженерные меры защиты",
          lead: "Мы применяем современные стандарты информационной безопасности для защиты вашей конфиденциальности:",
          items: [
            {
              label: "Шифрование трафика (TLS 1.3)",
              text: "Все данные между вашим устройством и нашими серверами передаются по защищенному протоколу HTTPS.",
            },
            {
              label: "HttpOnly и SameSite Cookies",
              text: "Токены авторизации защищены от чтения клиентскими скриптами, что предотвращает кражу сессии через XSS-атаки.",
            },
            {
              label: "Защита от CSRF",
              text: "Все мутирующие запросы защищены криптографическими CSRF-токенами для предотвращения межсайтовых подделок.",
            },
          ],
        },
        {
          id: "operator",
          number: "07",
          title: "Оператор персональных данных и контакты",
          lead: "Moodila работает открыто и в соответствии с применимым законодательством о персональных данных:",
          paragraphs: [
            "Оператором сервиса и обработки персональных данных является физическое лицо Глинин Максим Сергеевич (Российская Федерация).",
            "Обработка данных осуществляется в соответствии с законодательством Российской Федерации, в том числе Федеральным законом № 152-ФЗ «О персональных данных». Регистрируя аккаунт или продолжая использовать сервис, вы даете добровольное согласие на обработку данных на условиях настоящей Политики.",
            "По любым вопросам защиты данных, отзыва согласия или реализации прав субъекта данных обращайтесь по официальному адресу: support@moodila.krunpy.ru.",
          ],
          callout: {
            type: "operator",
            title: "Сведения об операторе данных",
            operatorName: "Глинин Максим Сергеевич",
            legalFramework: "Федеральный закон № 152-ФЗ «О персональных данных»",
            contactEmail: "support@moodila.krunpy.ru",
          },
        },
      ],
    },
    terms: {
      title: "Условия использования",
      subtitle:
        "Правила, условия и взаимные обязательства, регулирующие использование сервиса Moodila.",
      lastUpdated: "Октябрь 2026",
      readTime: "4 мин. чтения",
      operator: "Оператор: М. С. Глинин",
      principlesTitle: "Коротко о правилах",
      principles: [
        {
          icon: "health_and_safety",
          title: "Самопомощь, а не медицина",
          desc: "Moodila — инструмент для самопомощи и рефлексии, а не клиническая помощь. В острой ситуации обратитесь к врачам или в службы спасения.",
        },
        {
          icon: "edit_note",
          title: "Ваш контент — ваш",
          desc: "Вы сохраняете исключительные авторские права на все свои заметки, мысли и фотографии.",
        },
        {
          icon: "handshake",
          title: "Взаимное уважение",
          desc: "Запрещены оскорбления, токсичное поведение, вредоносный контент и любые попытки взлома.",
        },
      ],
      sections: [
        {
          id: "acceptance",
          number: "01",
          title: "Принятие условий",
          lead: "Регистрируя учетную запись, устанавливая PWA-приложение или используя Moodila, вы соглашаетесь соблюдать настоящие Условия использования. Если вы не согласны с условиями, пожалуйста, прекратите использование приложения.",
        },
        {
          id: "medical-disclaimer",
          number: "02",
          title: "Медицинское предостережение",
          lead: "Moodila создана исключительно для личной осознанности, ведения дневника и рефлексии.",
          paragraphs: [
            "MOODILA НЕ ЯВЛЯЕТСЯ МЕДИЦИНСКИМ ПРИБОРОМ, КЛИНИЧЕСКИМ МЕДИЦИНСКИМ СЕРВИСОМ ИЛИ СЛУЖБОЙ ЭКСТРЕННОЙ ПОМОЩИ. Приложение не предназначено для постановки психиатрических диагнозов, назначения лечения или оказания неотложной помощи.",
            "Использование приложения не заменяет консультации с квалифицированными врачами или психотерапевтами.",
            "Если вы переживаете острый кризис, суицидальные мысли или вам требуется неотложная помощь, немедленно обратитесь в городские экстренные службы или на горячую линию психологической помощи.",
          ],
          callout: {
            type: "warning",
            title: "Важное медицинское предупреждение",
            text: "Moodila — дневник для рефлексии. Приложение не заменяет медицинскую помощь и не является кризисной службой. В острой ситуации обращайтесь к специалистам.",
          },
        },
        {
          id: "eligibility",
          number: "03",
          title: "Требования к аккаунту и безопасность",
          lead: "Правила для поддержания безопасной среды и защиты доступа:",
          items: [
            {
              label: "Возрастные ограничения",
              text: "Вам должно быть не менее 13 лет (или возраста совершеннолетия в вашей юрисдикции) для создания учетной записи.",
            },
            {
              label: "Конфиденциальность пароля",
              text: "Вы несете личную ответственность за сохранение конфиденциальности пароля и за любые действия, совершенные под вашим аккаунтом.",
            },
            {
              label: "Уведомление об инцидентах",
              text: "В случае подозрения на несанкционированный доступ к аккаунту незамедлительно свяжитесь с поддержкой: support@moodila.krunpy.ru.",
            },
          ],
        },
        {
          id: "content-rights",
          number: "04",
          title: "Права на пользовательский контент",
          lead: "Ваши записи и мысли принадлежат только вам. Мы уважаем ваши интеллектуальные права:",
          paragraphs: [
            "Вы сохраняете все авторские и исключительные права на любые тексты, оценки настроения, мысли и фотографии, которые вы создаете в приложении.",
            "Вы предоставляете Moodila ограниченную неисключительную лицензию только на техническое хранение, передачу и отображение контента вам и выбранным вами друзьям в рамках работы приложения.",
            "Эта лицензия прекращает свое действие сразу после удаления записи или удаления вашего аккаунта.",
          ],
        },
        {
          id: "conduct",
          number: "05",
          title: "Запрещенное поведение",
          lead: "Для сохранения атмосферы спокойствия и доверия на платформе категорически запрещается:",
          items: [
            {
              label: "Оскорбления и травля",
              text: "Преследование, запугивание, угрозы или оскорбления других пользователей через реакции, имена или записи.",
            },
            {
              label: "Незаконный контент",
              text: "Загрузка вредоносного, противозаконного или нарушающего чужие права контента.",
            },
            {
              label: "Взлом и атаки",
              text: "Попытки несанкционированного доступа к чужим аккаунтам, эксплуатация уязвимостей или нарушение стабильности серверов.",
            },
            {
              label: "Парсинг и сбор данных",
              text: "Использование автоматизированных скриптов или ботов без предварительного письменного согласия.",
            },
          ],
        },
        {
          id: "termination",
          number: "06",
          title: "Удаление и блокировка аккаунта",
          lead: "Вы можете прекратить использование сервиса в любой момент:",
          paragraphs: [
            "Вы можете самостоятельно удалить аккаунт в настройках профиля, что приведет к полному стиранию ваших данных.",
            "Мы оставляем за собой право заблокировать аккаунт в случае грубых или повторяющихся нарушений настоящих Условий.",
          ],
        },
        {
          id: "warranties",
          number: "07",
          title: "Отказ от гарантий и ограничение ответственности",
          lead: "Юридические положения об ответственности:",
          paragraphs: [
            "Сервис Moodila предоставляется на условиях «КАК ЕСТЬ» и «ПО МЕРЕ ДОСТУПНОСТИ» без каких-либо прямых или подразумеваемых гарантий.",
            "В максимально допустимой законом степени администрация сервиса не несет ответственности за любой косвенный ущерб или упущенную выгоду, возникшие в связи с использованием сервиса.",
          ],
        },
        {
          id: "governing-law",
          number: "08",
          title: "Применимое право и оператор",
          lead: "Юрисдикция и контактная информация оператора:",
          paragraphs: [
            "Настоящие Условия и любые споры регулируются законодательством Российской Федерации.",
            "Оператором и администратором сервиса является физическое лицо Глинин Максим Сергеевич. Официальные обращения принимаются по адресу support@moodila.krunpy.ru.",
          ],
          callout: {
            type: "operator",
            title: "Сведения об операторе",
            operatorName: "Глинин Максим Сергеевич",
            legalFramework: "Регулируется законодательством Российской Федерации",
            contactEmail: "support@moodila.krunpy.ru",
          },
        },
        {
          id: "changes",
          number: "09",
          title: "Изменения условий",
          lead: "Мы можем периодически обновлять настоящие Условия:",
          paragraphs: [
            "Существенные изменения условий будут сопровождаться уведомлением в интерфейсе приложения.",
            "Продолжение использования Moodila после вступления изменений в силу означает ваше согласие с новой редакцией.",
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
  const { isDark, toggleTheme } = useTheme();

  const isTerms = location.pathname.includes("terms") || initialMode === "terms";
  const activeMode = isTerms ? "terms" : "privacy";

  const langKey = language === "ru" ? "ru" : "en";
  const doc = LEGAL_DOCS[langKey][activeMode];

  const [activeSectionId, setActiveSectionId] = useState(doc.sections[0]?.id || "");
  const observerRef = useRef(null);

  // Set up intersection observer for table of contents active highlighting
  useEffect(() => {
    const handleIntersect = (entries) => {
      const visible = entries.find((e) => e.isIntersecting);
      if (visible) {
        setActiveSectionId(visible.target.id);
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: "-80px 0px -70% 0px",
      threshold: 0,
    });

    const elements = doc.sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [doc.sections, activeMode]);

  // Handle deep-link anchor when activeMode changes
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace("#", "");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeMode, location.hash]);

  const handleBack = () => {
    haptics.selection();
    safeNavigateBack(navigate, "/");
  };

  const scrollToSection = (id) => {
    haptics.selection();
    setActiveSectionId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    haptics.selection();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-on-surface selection:bg-primary-container selection:text-on-primary-container font-sans antialiased flex flex-col justify-between transition-colors duration-200">
      {/* ─── TOP MASTHEAD NAVIGATION ─── */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-outline-variant/20 pt-safe-top">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Back button & Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-label-md font-semibold text-on-surface transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              aria-label={t("legal.back")}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">{t("legal.back")}</span>
            </button>

            <Link
              to="/"
              className="flex items-center gap-2 group rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <AppLogo className="w-7 h-7 rounded-lg shadow-subtle shrink-0" />
              <span className="font-display text-headline-sm font-bold text-on-surface tracking-tight">
                Moodila
              </span>
            </Link>
          </div>

          {/* Quick Switcher & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                toggleTheme();
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={isDark ? "Light theme" : "Dark theme"}
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined text-[19px]">
                {isDark ? "light_mode" : "dark_mode"}
              </span>
            </button>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                toggleLanguage();
              }}
              className="flex items-center gap-1 px-3 h-9 rounded-full bg-surface-container-low hover:bg-surface-container text-label-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={language === "ru" ? "Switch to English" : "Переключить на русский"}
              aria-label="Toggle language"
            >
              <span className="material-symbols-outlined text-[16px]">language</span>
              <span>{language.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN HERO & DOCUMENT SWITCHER ─── */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        {/* Document Switcher Tabs */}
        <div className="flex items-center mb-6">
          <nav
            aria-label="Document switcher"
            className="inline-flex p-1 bg-surface-container-low rounded-xl border border-outline-variant/30"
          >
            <Link
              to="/privacy"
              onClick={() => haptics.selection()}
              className={`px-4 sm:px-5 py-2 rounded-lg text-label-md font-semibold transition-all ${
                activeMode === "privacy"
                  ? "bg-surface-container-lowest text-on-surface shadow-subtle"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t("legal.privacyPolicy")}
            </Link>
            <Link
              to="/terms"
              onClick={() => haptics.selection()}
              className={`px-4 sm:px-5 py-2 rounded-lg text-label-md font-semibold transition-all ${
                activeMode === "terms"
                  ? "bg-surface-container-lowest text-on-surface shadow-subtle"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t("legal.termsOfService")}
            </Link>
          </nav>
        </div>

        {/* Editorial Masthead */}
        <div className="border-b border-outline-variant/20 pb-8 mb-10">
          <h1 className="font-display text-display-md sm:text-display-lg md:text-display-xl font-normal text-on-surface tracking-tight mb-3">
            {doc.title}
          </h1>
          <p className="text-body-lg text-on-surface-variant font-normal leading-relaxed max-w-[65ch] mb-4">
            {doc.subtitle}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-on-surface-variant/80 font-medium">
            <span>{t("legal.lastUpdated")}</span>
            <span aria-hidden="true">•</span>
            <span>{doc.readTime}</span>
            <span aria-hidden="true">•</span>
            <span>{doc.operator}</span>
          </div>
        </div>

        {/* ─── AT A GLANCE (KEY PRINCIPLES) ─── */}
        <section aria-labelledby="principles-heading" className="mb-12">
          <h2
            id="principles-heading"
            className="text-label-sm uppercase tracking-wider font-semibold text-on-surface-variant/80 mb-4"
          >
            {doc.principlesTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {doc.principles.map((p, idx) => (
              <div
                key={idx}
                className="bg-surface-container-low/70 border border-outline-variant/30 rounded-2xl p-5 hover:border-outline-variant/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-container/30 text-primary flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[20px]">{p.icon}</span>
                </div>
                <h3 className="font-semibold text-body-md text-on-surface mb-1.5">{p.title}</h3>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mobile Horizontal Quick Jump Bar */}
        <div className="lg:hidden mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
          <p className="text-label-xs uppercase tracking-wider font-semibold text-on-surface-variant/70 mb-2">
            {t("legal.tocTitle")}
          </p>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {doc.sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-label-sm font-medium transition-all ${
                  activeSectionId === s.id
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {s.number}. {s.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── TWO-COLUMN READING BODY ─── */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex-1 mb-16">
        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-14 items-start">
          {/* Sticky Sidebar / Table of Contents (Desktop) */}
          <aside className="hidden lg:block sticky top-24 self-start space-y-8 pr-2">
            <nav aria-label="Table of contents" className="space-y-1">
              <p className="text-label-xs uppercase tracking-wider font-semibold text-on-surface-variant/70 mb-3 px-3">
                {t("legal.tocTitle")}
              </p>
              {doc.sections.map((s) => {
                const isActive = activeSectionId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className={`w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-xl text-body-sm transition-all cursor-pointer ${
                      isActive
                        ? "bg-surface-container font-semibold text-on-surface shadow-xs"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/60"
                    }`}
                  >
                    <span
                      className={`text-label-xs font-semibold mt-0.5 ${
                        isActive ? "text-primary" : "text-on-surface-variant/60"
                      }`}
                    >
                      {s.number}
                    </span>
                    <span className="leading-snug">{s.title}</span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Contact Box */}
            <div className="p-4 rounded-2xl bg-surface-container-low/60 border border-outline-variant/30 space-y-2">
              <p className="text-label-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                {t("legal.contactSupport")}
              </p>
              <a
                href="mailto:support@moodila.krunpy.ru"
                className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary hover:underline break-all"
              >
                <span className="material-symbols-outlined text-[16px]">mail</span>
                <span>support@moodila.krunpy.ru</span>
              </a>
            </div>
          </aside>

          {/* Reading Column */}
          <article className="max-w-[70ch] space-y-14">
            {doc.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24 border-t border-outline-variant/20 pt-10 first:border-t-0 first:pt-0 space-y-5"
              >
                {/* Section Header */}
                <div>
                  <span className="text-secondary/80 font-sans text-label-xs font-bold tracking-widest uppercase block mb-1">
                    {section.number}
                  </span>
                  <h2 className="font-display text-headline-lg font-normal text-on-surface tracking-tight">
                    {section.title}
                  </h2>
                </div>

                {/* Section Lead */}
                {section.lead && (
                  <p className="text-body-md text-on-surface leading-relaxed text-pretty">
                    {section.lead}
                  </p>
                )}

                {/* Structured Items List */}
                {section.items && (
                  <div className="space-y-3.5 pt-1">
                    {section.items.map((item, iIdx) => (
                      <div
                        key={iIdx}
                        className="p-4 rounded-xl bg-surface-container-lowest/70 border border-outline-variant/20 space-y-1"
                      >
                        <h3 className="text-body-md font-semibold text-on-surface">
                          {item.label}
                        </h3>
                        <p className="text-body-sm text-on-surface-variant leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paragraphs */}
                {section.paragraphs && (
                  <div className="space-y-3.5">
                    {section.paragraphs.map((p, pIdx) => (
                      <p
                        key={pIdx}
                        className="text-body-md text-on-surface-variant leading-relaxed text-pretty"
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                )}

                {/* Callout Notice */}
                {section.callout && (
                  <div
                    className={`rounded-2xl p-5 sm:p-6 border flex items-start gap-3.5 ${
                      section.callout.type === "warning"
                        ? "bg-warning-container/20 border-warning/30 text-on-surface"
                        : "bg-surface-container-low border-outline-variant/40 text-on-surface"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[22px] shrink-0 mt-0.5 ${
                        section.callout.type === "warning" ? "text-warning" : "text-primary"
                      }`}
                    >
                      {section.callout.type === "warning" ? "health_and_safety" : "verified_user"}
                    </span>
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-body-md text-on-surface">
                        {section.callout.title}
                      </h4>
                      {section.callout.text && (
                        <p className="text-body-sm text-on-surface-variant leading-relaxed">
                          {section.callout.text}
                        </p>
                      )}
                      {section.callout.operatorName && (
                        <div className="text-body-sm text-on-surface-variant space-y-0.5 pt-1">
                          <p>
                            <span className="font-medium text-on-surface">Operator:</span>{" "}
                            {section.callout.operatorName}
                          </p>
                          <p>
                            <span className="font-medium text-on-surface">Framework:</span>{" "}
                            {section.callout.legalFramework}
                          </p>
                          <p>
                            <span className="font-medium text-on-surface">Inquiries:</span>{" "}
                            <a
                              href={`mailto:${section.callout.contactEmail}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {section.callout.contactEmail}
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            ))}
          </article>
        </div>
      </main>

      {/* ─── EDITORIAL FOOTER ─── */}
      <footer className="border-t border-outline-variant/20 bg-surface-container-low/40 pt-8 pb-safe-bottom">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-label-sm text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} Moodila.</span>
            <span>{t("landing.footerRights")}</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to={activeMode === "privacy" ? "/terms" : "/privacy"}
              onClick={() => haptics.selection()}
              className="text-primary hover:underline font-medium"
            >
              {activeMode === "privacy" ? t("legal.termsOfService") : t("legal.privacyPolicy")}
            </Link>
            <span aria-hidden="true">•</span>
            <Link
              to="/"
              onClick={() => haptics.selection()}
              className="hover:text-on-surface transition-colors font-medium"
            >
              {t("legal.home")}
            </Link>
            <span aria-hidden="true">•</span>
            <button
              type="button"
              onClick={scrollToTop}
              className="flex items-center gap-1 hover:text-on-surface transition-colors font-medium cursor-pointer"
            >
              <span>{t("legal.backToTop")}</span>
              <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
