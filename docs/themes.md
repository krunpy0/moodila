# Темы оформления и сезонность

Сверено с кодом 9 ноября 2026 года.

## Реестр и хранение

- `frontend/src/utils/themes.js`: `THEME_FAMILIES`, `THEMES`, метаданные и цвета превью.
- `frontend/src/index.css`: CSS-токены и декор. Цвета для Tailwind задаются RGB-каналами через пробел для работы модификаторов прозрачности.
- `frontend/src/context/ThemeContext.jsx`: применение `data-theme` и `.dark`, загрузка сезонной доступности, откат недоступной темы.
- `frontend/index.html`: ранняя установка темы до React; при изменении ID и начальных цветов проверьте этот скрипт.
- `frontend/src/components/ThemePickerModal.jsx`: селектор и превью. Выбор хранится в `localStorage` (`moodshare_theme`), без записи в БД.

Постоянные семейства: `classic`, `sakura`, `forest`, `ocean`, `lavender`, `terracotta`, `aurora`. По два варианта; у classic ID `light` / `dark`, у остальных — `<family>-light` / `<family>-dark`. Сакура доступна круглый год и не имеет `seasonal: true`.

Сезонные семейства: `halloween` и `new-year`, также по два варианта. Всего 9 семейств и 18 вариантов; сезонные доступны не всегда.

## Серверный календарь

Источник — `backend/internal/handlers/features.go`. Публичные `GET /app/features` и `/features` возвращают `active_seasonal_themes`, `seasonal_themes`, `halloween_enabled` (совместимость) и `server_time`.

| Семейство | Начало включительно | Конец исключительно |
|---|---|---|
| `halloween` | 21 октября | 4 ноября |
| `new-year` | 1 декабря | 8 января следующего года |

`IsSeasonalThemeActive` поддерживает переход через границу года. Используется время сервера; `X-Mock-Date` позволяет подменить дату запроса. Непустой `SEASONAL_THEMES_OVERRIDE` заменяет активные темы списком ID через запятую. Пустое значение возвращает обычный календарь, а не выключает сезоны.

Клиент кеширует доступность в `moodshare_active_seasonal_themes`. Если сезон завершился, выбранная сезонная тема заменяется базовым `light` или `dark` того же режима. Не дублируйте календарные даты во фронтенде.

## Изменение и добавление темы

1. Добавьте постоянное семейство и оба варианта в `themes.js`, CSS-токены в `index.css`; сверьте раннюю установку в `index.html`.
2. Для сезонной темы дополнительно задайте `seasonal: true` и окно с тем же ID в `DefaultSeasonalWindows`. Поля `AlwaysActive` в `SeasonalThemeWindow` нет: постоянным темам серверное окно не требуется.
3. Декор подключается через `HalloweenDecorations`, `NewYearDecorations`, `SakuraDecorations`. Учитывайте `prefers-reduced-motion`, доступность и отсутствие перехвата нажатий.
4. Проверьте оба режима, читаемость настроений, сохранение выбора, завершение сезона и синхронизацию превью лендинга (`LandingAppPreview.jsx`, `src/landing-preview/`).

Проверки: `go test ./internal/handlers -run 'Seasonal|Halloween|NewYear|Features'` из backend; `node --test src/utils/*Theme*.test.js` из frontend; lint и build по [AGENTS.md](../AGENTS.MD).
