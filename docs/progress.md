# Журнал прогресса

Каждый шаг плана (`spec/SPEC.md` §13) и каждое изменение поведения фиксируются здесь после
зелёных гейтов и чистого ревью — до коммита. Новые записи сверху.

Формат записи: дата, шаг, что сделано, решения/отклонения от спецификации, состояние гейтов,
что осталось открытым.

---

## 2026-11-04 — Шаг 0: каркас проекта

**Сделано**
- Frontend: Vite 7 + React 18.3 + TypeScript 5.9 (strict), Mantine 8.3 (core, form,
  notifications, modals) с PostCSS, TanStack Query 5, react-router 7, supabase-js 2.
  Оболочка `src/`: `AppProviders` (Mantine → Notifications → Modals → QueryClient), `App` с одним
  маршрутом `/`, клиент Supabase (`src/shared/api/supabase/`) с проверкой `VITE_`-переменных.
- Инструменты: ESLint 9 (flat config, правило `padding-line-between-statements`), Prettier,
  Vitest 3 (фронт — jsdom, `vitest.config.ts`; БД — node, `vitest.db.config.ts`).
- Backend: Supabase CLI 2.122 как devDependency, `supabase init`, регистрация отключена
  (`[auth]` и `[auth.email]` → `enable_signup = false`), пустая папка миграций, `seed.sql`-заглушка.
- Хелпер тестов БД `tests/db/env/env.ts`: читает только `.env.test.local`, отказывается
  работать с не-локальным Supabase, быстро падает при недоступности локального инстанса.
- `vercel.json` (SPA rewrite), `.env.example`, `.gitignore` (`.env*`, `.vercel/`).

**Решения**
- `dotenv` не используется: тесты БД читают env через `node:util` `parseEnv`, чтобы корневой
  `.env` с облачными секретами никогда не попадал в процесс тестов.
- Скрипт `seed` появится на шаге 3 вместе с `scripts/seed.ts`.
- `main.tsx` пока не импортирует клиент Supabase (подключается на шаге 2).

**Гейты:** lint, typecheck, test (12), test:db (10, без Docker), build — зелёные.

**Открыто**
- `npm audit`: 16 уязвимостей (2 critical) только в dev-инструментах; в прод-бандл не попадают.
- Для шага 1 нужен запущенный Docker Desktop (`npx supabase start`).
