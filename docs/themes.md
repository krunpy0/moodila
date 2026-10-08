# Subsystem Guide: Themes & Seasonal Features (Темы оформления и сезонность)

Этот документ представляет собой полное архитектурное руководство и пошаговую инструкцию по подсистеме тем оформления и сезонных событий в приложении **Moodila**. Используйте его при добавлении новых тем, изменении существующих палитр или расширении календаря сезонных событий.

---

## 1. Архитектурный обзор (Architecture Overview)

Подсистема тем Moodila построена на принципах **декларативности, предсказуемости и нулевого FOUC** (Flash of Unstyled Content).

```
┌────────────────────────────────────────────────────────┐
│            1. Backend: Calendar & Feature Flags        │
│          (backend/internal/handlers/features.go)       │
│   - DefaultSeasonalWindows (даты начала и окончания)   │
│   - Поддержка перехода через границу года (New Year)   │
│   - Переопределение через SEASONAL_THEMES_OVERRIDE     │
│   - GET /app/features & GET /features                  │
└───────────────────────────┬────────────────────────────┘
                            │ active_seasonal_themes: ["halloween", ...]
                            ▼
┌────────────────────────────────────────────────────────┐
│           2. Frontend Context & Storage Sync           │
│           (frontend/src/context/ThemeContext.jsx)      │
│   - Кеш в localStorage ('moodshare_active_seasonal_themes')│
│   - Автоматический Graceful Fallback при конце сезона  │
│   - Установка data-theme и .dark на <html>             │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────────┐   ┌──────────────────────────┐
│  3. Token Specification │   │   4. User Interface      │
│ (src/index.css,         │   │ (ThemePickerModal.jsx,   │
│  src/utils/themes.js)   │   │  Profile.jsx, etc.)      │
│ - RGB триплеты каналов  │   │ - Живое превью палитры   │
│ - 5 цветов настроений   │   │ - Фильтр: Все / Свет / Тьма│
│ - Zero-FOUC в index.html│   │ - Haptic feedback        │
└─────────────────────────┘   └──────────────────────────┘
```

### Ключевые принципы:

1. **Хранение настроек на клиенте:** Текущая выбранная пользователем тема хранится в `localStorage` (`moodshare_theme`) и **не требует записи в базу данных**.
2. **Сервер — единый источник правды для сезонности:** Доступность сезонных тем (`seasonal: true`) регулируется бэкендом через эндпоинт `/app/features`. Клиент не должен сам хардкодить даты активности на фронтенде.
3. **Безопасный откат (Graceful Fallback):** Если у пользователя была включена сезонная тема (например, `halloween-dark`), а сезон завершился, `ThemeContext` автоматически сбрасывает тему на базовый аналог того же режима (`dark` или `light`), предотвращая показ недоступного или сломанного стиля.
4. **Zero-FOUC (устранение мерцания при загрузке):** В теге `<head>` в `frontend/index.html` встроен синхронный скрипт, который до выполнения React читает `moodshare_theme` и выставляет нужный `data-theme`, класс `dark` и мета-тег `<meta name="theme-color">`.
5. **Формат CSS-переменных Tailwind:** Все токены цветов в `frontend/src/index.css` задаются в виде **RGB-триплетов через пробел** (например, `243 246 242`, а не `#F3F6F2` или `rgb(...)`). Это позволяет Tailwind применять модификаторы прозрачности вида `bg-primary/20`.

---

## 2. Как сервер управляет темами (`backend/internal/handlers/features.go`)

### 2.1. Модели данных

```go
// SeasonalThemeStatus описывает доступность темы для фронтенда
type SeasonalThemeStatus struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
}

// FeaturesResponse возвращается по GET /app/features
type FeaturesResponse struct {
	ActiveSeasonalThemes []string              `json:"active_seasonal_themes"`
	SeasonalThemes       []SeasonalThemeStatus `json:"seasonal_themes"`
	HalloweenEnabled     bool                  `json:"halloween_enabled"` // Для обратной совместимости
	ServerTime           time.Time             `json:"server_time"`
}

// SeasonalThemeWindow определяет календарные границы активности
type SeasonalThemeWindow struct {
	ID         string     `json:"id"`
	StartMonth time.Month `json:"-"`
	StartDay   int        `json:"-"`
	EndMonth   time.Month `json:"-"`
	EndDay     int        `json:"-"`
}
```

### 2.2. Регистрация сезонных окон (`DefaultSeasonalWindows`)

Все сезонные темы регистрируются в срезе `DefaultSeasonalWindows`:

```go
var DefaultSeasonalWindows = []SeasonalThemeWindow{
	{
		ID:         "halloween",
		StartMonth: time.October,
		StartDay:   21,
		EndMonth:   time.November,
		EndDay:     4, // Активна по 3 ноября 23:59:59 включительно (до 4 ноя 00:00:00)
	},
	{
		ID:         "new-year",
		StartMonth: time.December,
		StartDay:   15,
		EndMonth:   time.January,
		EndDay:     15, // Активна по 14 янв 23:59:59 (переход границы календарного года)
	},
	{
		ID:           "sakura",
		AlwaysActive: true, // Сезонная тема сакуры, доступная круглый год без ограничений по дате
	},
}
```

### 2.3. Алгоритм проверки активности (`IsSeasonalThemeActive`)

Алгоритм учитывает следующие сценарии:

1. **Постоянная активность темы** (`AlwaysActive: true` или `StartMonth == 0 && EndMonth == 0`): Тема активна всегда без привязки к конкретным числам.
2. **В пределах одного года** (`StartMonth <= EndMonth`): Тема активна, если текущая дата $\ge$ `Start` и $<$ `End`.
3. **Переход через Новый год** (`StartMonth > EndMonth`): Окно охватывает конец текущего года и начало следующего. Условие истинно, если дата $\ge$ `Start` **ИЛИ** $<$ `End`.

### 2.4. Переопределение и тестирование

1. **Переопределение через переменные окружения:**
   Если задана переменная `SEASONAL_THEMES_OVERRIDE` (например, `SEASONAL_THEMES_OVERRIDE="new-year,custom"`), бэкенд возвращает ровно указанные ID, игнорируя системные часы.
2. **Тестирование по заголовку `X-Mock-Date`:**
   Функция `ParseRequestTime(c *gin.Context)` считывает заголовок `X-Mock-Date: 2026-10-31T12:00:00Z` или `2026-10-31`, что позволяет тестировать сезонные состояния без изменения системного времени сервера.

---

## 3. Клиентская подсистема тем (Frontend Architecture)

### 3.1. Структура метаданных (`frontend/src/utils/themes.js`)

Каждая тема принадлежит **семейству** (`THEME_FAMILIES`). В семействе всегда предусмотрены 2 варианта: `light` и `dark`.

```javascript
// 1. Определение семейства
export const THEME_FAMILIES = {
  forest: {
    id: "forest",
    ru: "Лес и матча",
    en: "Pine & Matcha",
    descRu: "Шалфей, хвоя, чай матча и медитативный природный покой",
    descEn: "Sage, pine needles, matcha tea, and grounded natural stillness",
  },
  halloween: {
    id: "halloween",
    seasonal: true, // Флаг сезонности! Требует совпадения ID с бэкендом
    ru: "Хеллоуин",
    en: "Spooky Autumn",
    descRu: "Пряная тыква, мистический аметист и мерцание свечей в ночи",
    descEn: "Roasted pumpkin, mystical amethyst, and glowing candlelit vibes",
  },
  sakura: {
    id: "sakura",
    seasonal: true, // Сезонная тема цветущей сакуры
    ru: "Сакура",
    en: "Cherry Blossom",
    descRu:
      "Цветущая сакура, весенняя свежесть, акварельный туман и эстетика ханами",
    descEn:
      "Blooming cherry petals, springtime freshness, and serene hanami aesthetics",
  },
};

// 2. Определение вариантов тем (THEMES)
export const THEMES = [
  {
    id: "forest-light",
    family: "forest",
    mode: "light",
    nameRu: "Лес и матча (Светлая)",
    nameEn: "Pine & Matcha (Light)",
    metaColor: "#F3F6F2", // Цвет для theme-color в мобильном браузере
    colors: {
      bg: "#F3F6F2",
      surface: "#FFFFFF",
      surfaceContainer: "#E7EEE6",
      primary: "#2E6845",
      onPrimary: "#FFFFFF",
      secondary: "#5C7C6D",
      tertiary: "#8E6B47",
      onSurface: "#142218",
      onSurfaceVariant: "#4E6253",
      border: "#CCD8CD",
      // Палитра настроений: [awful, bad, meh, good, awesome]
      moods: ["#2E6845", "#55873C", "#A87A28", "#BA6536", "#B24D54"],
    },
  },
  // ... и forest-dark
];
```

### 3.2. Логика синхронизации и Fallback (`ThemeContext.jsx`)

1. При монтировании темы читаются из `localStorage`:
   - `moodshare_theme` — выбранный ID темы (по умолчанию `'light'`).
   - `moodshare_active_seasonal_themes` — кэшированный список активных сезонов.
2. Хук `useAppFeaturesQuery()` запрашивает свежие фичи с бэкенда (`/app/features`).
3. При ответе сервера:
   - Обновляется стейт `activeSeasonalThemes`.
   - Вызывается `getFallbackTheme(currentTheme, nextActive)`. Если текущая тема сезонная, а её сезон кончился (`!isThemeAvailable(...)`), стейт немедленно сбрасывается на `dark` или `light`.
4. Функция `applyThemeToDOM(themeId)`:
   - Выставляет `document.documentElement.setAttribute('data-theme', themeId)`.
   - Добавляет или убирает класс `dark`.
   - Выставляет `style.colorScheme = 'dark' | 'light'`.
   - Обновляет тег `<meta name="theme-color">`.

### 3.3. Сезонная тема «Сакура» (Hanami & Yozakura)

Сезонная тема Сакуры вдохновлена японской эстетикой ханами и ночного любования сакурой ёдзакура:

- **`sakura-light` (Hanami):**
  - Фарфорово-розовая основа васи (`#FDF8FA`), цветущая розовая сакура (`#D14270`), акценты весеннего чая матча (`#3A7552`) и древесной бронзы (`#8E5E44`).
  - Атмосферный акварельный туман _Kasumi_ (`radial-gradient` в `src/index.css`).
- **`sakura-dark` (Yozakura):**
  - Ночное небо Киото (`#120E18`), бархатная индиго-сливовая поверхность (`#1A1422`), лунные лепестки (`#F78DAF`), ночной бамбук (`#6BC497`) и тёплое янтарное сияние бумажных фонарей тётин (`#F5A742`).
- **Векторная ботаника и физика анимации:**
  - Компоненты `SakuraIcons.jsx` содержат оригинальную векторную геометрию: 5-лепестковый цветок с выемкой (_sakura-benbana_), золотыми тычинками и веткой в стиле Суми-э.
  - Оверлей `SakuraDecorations.jsx` реализует многослойное падение лепестков с естественным 3D-вращением (`sakuraPetalTumble`) и покачиванием ветви, с полной поддержкой `prefers-reduced-motion`.
  - Модальное окно `ThemePickerModal.jsx` отображает сезонный бейдж «Ханами» и точную цветовую шкалу 5 уровней настроения (от изумрудного восторга до дикой вишни).

---

## 4. Пошаговые инструкции по добавлению темы (How-To Guides)

В зависимости от назначения новой темы выберите соответствующий сценарий:

---

### Сценарий А. Добавление постоянной темы (Permanent Theme)

_Постоянные темы доступны 365 дней в году и не требуют изменений в Go бэкенде или базе данных._

#### Шаг A1: Зарегистрируйте семейство в `frontend/src/utils/themes.js`

В объекте `THEME_FAMILIES` добавьте новый ключ:

```javascript
nordic: {
  id: 'nordic',
  ru: 'Скандинавский туман',
  en: 'Nordic Mist',
  descRu: 'Холодная лаконичность, туманный сланец и кристальная тишина',
  descEn: 'Cool minimalism, foggy slate, and crisp northern silence',
},
```

#### Шаг A2: Добавьте Light и Dark варианты в массив `THEMES` (`themes.js`)

Каждая тема должна иметь идентификатор `${family}-light` и `${family}-dark`:

```javascript
{
  id: 'nordic-light',
  family: 'nordic',
  mode: 'light',
  nameRu: 'Скандинавский туман (Светлая)',
  nameEn: 'Nordic Mist (Light)',
  metaColor: '#F4F5F7',
  colors: {
    bg: '#F4F5F7',
    surface: '#FFFFFF',
    surfaceContainer: '#E8EBF0',
    primary: '#3B5971',
    onPrimary: '#FFFFFF',
    secondary: '#5C6E7C',
    tertiary: '#7F675B',
    onSurface: '#191E23',
    onSurfaceVariant: '#58616B',
    border: '#CFD6DE',
    moods: ['#2F7466', '#598544', '#9E7A32', '#B56743', '#AB4E5E'],
  },
},
{
  id: 'nordic-dark',
  family: 'nordic',
  mode: 'dark',
  nameRu: 'Скандинавский туман (Тёмная)',
  nameEn: 'Nordic Mist (Dark)',
  metaColor: '#12161A',
  colors: {
    bg: '#12161A',
    surface: '#1A2026',
    surfaceContainer: '#222B33',
    primary: '#7EABC9',
    onPrimary: '#0C2638',
    secondary: '#94ABB9',
    tertiary: '#CBB2A6',
    onSurface: '#EEF2F6',
    onSurfaceVariant: '#9EACB8',
    border: '#2F3C47',
    moods: ['#5BBFA8', '#90C675', '#DCB365', '#DB835B', '#D56E7F'],
  },
},
```

#### Шаг A3: Задайте CSS-токены в `frontend/src/index.css`

Добавьте селекторы `:root[data-theme="nordic-light"]` и `:root[data-theme="nordic-dark"]`.

> [!IMPORTANT]
> Значения задаются строго в виде RGB-каналов без `rgb()` и без запятых: `R G B`.

Обязательный список токенов для каждого варианта:

```css
:root[data-theme="nordic-light"] {
  /* Canvas & Surface */
  --color-background: 244 245 247;
  --color-on-background: 25 30 35;
  --color-surface: 244 245 247;
  --color-surface-dim: 228 232 237;
  --color-surface-bright: 255 255 255;
  --color-surface-container-lowest: 255 255 255;
  --color-surface-container-low: 248 249 251;
  --color-surface-container: 240 243 246;
  --color-surface-container-high: 232 236 240;
  --color-surface-container-highest: 224 229 234;
  --color-surface-variant: 224 229 234;
  --color-surface-tint: 59 89 113;
  --color-on-surface: 25 30 35;
  --color-on-surface-variant: 88 97 107;
  --color-outline: 140 152 163;
  --color-outline-variant: 207 214 222;
  --color-inverse-surface: 32 39 46;
  --color-inverse-on-surface: 243 246 249;

  /* Primary */
  --color-primary: 59 89 113;
  --color-on-primary: 255 255 255;
  --color-primary-container: 219 233 245;
  --color-on-primary-container: 18 42 61;
  --color-inverse-primary: 153 197 229;
  --color-primary-fixed: 219 233 245;
  --color-primary-fixed-dim: 184 209 230;
  --color-on-primary-fixed: 12 31 46;
  --color-on-primary-fixed-variant: 42 69 90;

  /* Secondary */
  --color-secondary: 92 110 124;
  --color-on-secondary: 255 255 255;
  --color-secondary-container: 220 231 240;
  --color-on-secondary-container: 31 46 56;
  --color-secondary-fixed: 220 231 240;
  --color-secondary-fixed-dim: 189 205 218;
  --color-on-secondary-fixed: 18 31 39;
  --color-on-secondary-fixed-variant: 66 83 95;

  /* Tertiary */
  --color-tertiary: 127 103 91;
  --color-on-tertiary: 255 255 255;
  --color-tertiary-container: 243 230 223;
  --color-on-tertiary-container: 56 38 29;
  --color-tertiary-fixed: 243 230 223;
  --color-tertiary-fixed-dim: 220 200 190;
  --color-on-tertiary-fixed: 37 23 16;
  --color-on-tertiary-fixed-variant: 97 76 66;

  /* 5 Mood Levels */
  --color-mood-awesome: 47 116 102;
  --color-mood-awesome-container: 214 239 234;
  --color-on-mood-awesome-container: 14 55 47;
  --color-mood-good: 89 133 68;
  --color-mood-good-container: 226 242 218;
  --color-on-mood-good-container: 33 58 20;
  --color-mood-meh: 158 122 50;
  --color-mood-meh-container: 248 235 210;
  --color-on-mood-meh-container: 70 51 14;
  --color-mood-bad: 181 103 67;
  --color-mood-bad-container: 250 230 220;
  --color-on-mood-bad-container: 82 39 18;
  --color-mood-awful: 171 78 94;
  --color-mood-awful-container: 247 220 225;
  --color-on-mood-awful-container: 84 25 36;

  /* Shadows */
  --shadow-color-subtle: rgba(25, 30, 35, 0.03);
  --shadow-color-card: rgba(25, 30, 35, 0.05);
  --shadow-color-floating: rgba(25, 30, 35, 0.09);
  --shadow-color-modal: rgba(25, 30, 35, 0.16);
  --elevation-subtle: 0 1px 2px var(--shadow-color-subtle);
  --elevation-card: 0 4px 20px var(--shadow-color-card);
  --elevation-floating: 0 10px 36px var(--shadow-color-floating);
  --elevation-modal: 0 20px 60px var(--shadow-color-modal);
}
```

#### Шаг A4: Добавьте `metaColor` в `frontend/index.html`

В объекте `themeMetaColors` внутри инлайн-скрипта в `<head>` добавьте оба значения:

```javascript
'nordic-light': '#F4F5F7',
'nordic-dark': '#12161A',
```

Это гарантирует отсутствие мигания цвета адресной строки и шторки Safari/PWA при холодном старте.

---

### Сценарий Б. Добавление сезонной темы (Seasonal Theme)

_Сезонные темы активируются только в заданный период года (или по флагу), а после окончания сезона плавно скрываются из модального окна и сбрасываются у пользователей._

#### Шаг B1: Зарегистрируйте сезонное окно на бэкенде (`backend/internal/handlers/features.go`)

В срез `DefaultSeasonalWindows` добавьте новую запись с уникальным строковым идентификатором (например, `spring` или `valentines`):

```go
{
	ID:         "valentines",
	StartMonth: time.February,
	StartDay:   7,
	EndMonth:   time.February,
	EndDay:     18, // Активна по 17 февраля 23:59:59 (до 18 фев 00:00:00)
},
```

#### Шаг B2: Добавьте юнит-тесты границ дат в `backend/internal/handlers/features_test.go`

Проверьте граничные условия (за день до старта, в день старта, в середине, на граничной дате и после окончания):

```go
func TestValentinesSeasonalThemeWindow(t *testing.T) {
	window := SeasonalThemeWindow{
		ID:         "valentines",
		StartMonth: time.February,
		StartDay:   7,
		EndMonth:   time.February,
		EndDay:     18,
	}
	assert.False(t, IsSeasonalThemeActive(window, time.Date(2026, time.February, 6, 23, 59, 59, 0, time.UTC)))
	assert.True(t, IsSeasonalThemeActive(window, time.Date(2026, time.February, 7, 0, 0, 0, 0, time.UTC)))
	assert.True(t, IsSeasonalThemeActive(window, time.Date(2026, time.February, 17, 23, 59, 59, 0, time.UTC)))
	assert.False(t, IsSeasonalThemeActive(window, time.Date(2026, time.February, 18, 0, 0, 0, 0, time.UTC)))
}
```

#### Шаг B3: Зарегистрируйте сезонное семейство в `frontend/src/utils/themes.js`

В `THEME_FAMILIES` укажите `seasonal: true`.

> [!WARNING]
> Значение `id` в `THEME_FAMILIES` обязано строго совпадать со значением `ID` из `DefaultSeasonalWindows` на бэкенде!

```javascript
valentines: {
  id: 'valentines',
  seasonal: true, // Помечает тему как сезонную
  ru: 'День влюблённых',
  en: 'Valentine Bloom',
  descRu: 'Нежная роза, рубиновое сердце и тёплые признания',
  descEn: 'Soft rose, ruby accents, and tender affectionate warmth',
},
```

#### Шаг B4: Добавьте варианты в массив `THEMES` (`themes.js`)

Укажите `family: 'valentines'` и `seasonal: true`:

```javascript
{
  id: 'valentines-light',
  family: 'valentines',
  seasonal: true,
  mode: 'light',
  nameRu: 'День влюблённых (Светлая)',
  nameEn: 'Valentine Bloom (Light)',
  metaColor: '#FCF5F7',
  colors: { /* палитра */ },
},
{
  id: 'valentines-dark',
  family: 'valentines',
  seasonal: true,
  mode: 'dark',
  nameRu: 'День влюблённых (Тёмная)',
  nameEn: 'Valentine Bloom (Dark)',
  metaColor: '#1A1114',
  colors: { /* палитра */ },
},
```

#### Шаг B5: Добавьте CSS-токены в `frontend/src/index.css`

Аналогично шагу A3, определите переменные `:root[data-theme="valentines-light"]` и `:root[data-theme="valentines-dark"]`.

#### Шаг B6: Добавьте `themeMetaColors` в `frontend/index.html`

Добавьте идентификаторы в инлайн-скрипт шапки:

```javascript
'valentines-light': '#FCF5F7',
'valentines-dark': '#1A1114',
```

#### Шаг B7 (Опционально): Добавьте атмосферный сезонный оверлей

Если для сезона предусмотрены визуальные эффекты (как паутинка и летучие мыши в `HalloweenDecorations.jsx`):

1. Создайте компонент `frontend/src/components/ValentinesDecorations.jsx`.
2. Подключите его в `frontend/src/components/AppLayout.jsx`, отображая при `activeSeasonalThemes.includes('valentines')`.
3. Обеспечьте `pointer-events: none` и отключение анимаций для `prefers-reduced-motion`.

---

## 5. Проверка и валидация (Verification Checklist)

Перед завершением задачи выполните следующий чек-лист:

1. **Компиляция бэкенда и тесты Go:**
   ```bash
   cd backend && go test -v ./internal/handlers/ -run "TestIsHalloweenSeasonAvailable|TestSeasonal"
   cd backend && go build ./cmd/api
   ```
2. **Интеграционные тесты сезонности фронтенда:**
   ```bash
   cd frontend && node --test src/utils/halloweenSeasonIntegration.test.js
   ```
3. **Линтинг и сборка фронтенда:**
   ```bash
   cd frontend && npm run lint
   cd frontend && npm run build
   ```
4. **Тестирование переопределения в рантайме (Overriding in Dev/Staging):**
   - Установите переменную окружения для бэкенда:
     ```bash
     SEASONAL_THEMES_OVERRIDE="valentines"
     ```
   - Запустите бэкенд и проверьте ответ `curl http://localhost:8080/app/features`:
     `active_seasonal_themes` должен содержать `["valentines"]`.
   - Откройте модальное окно выбора темы в браузере: новая сезонная тема должна появиться в списке.
   - Снимите переменную окружения: тема должна корректно скрыться, а у пользователей, выбравших её, должен сработать откат без ошибок в консоли.
