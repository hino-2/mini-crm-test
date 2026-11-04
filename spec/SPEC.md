# Спецификация: мини-CRM «Объекты и задачи»

Источник: `spec/initial_requirements.md` (тестовое задание). Этот документ — единственный источник
правды для агентов (architect, test-writers, developers, reviewers). Где ТЗ неоднозначно — решение
зафиксировано здесь (раздел 12) и должно попасть в `docs/decisions.md`.

---

## 1. Цель и критерии оценки

CRM для строительной компании: постановщик (руководитель) ставит задачи по объектам (стройкам),
исполнитель берёт их в работу и сдаёт на проверку.

Оценивают: **корректность логики**, **защиту данных на уровне БД**, понимание сделанного. Дизайн —
нет, нужен аккуратный понятный интерфейс.

Главный принцип: **все правила доступа и переходов живут в Postgres** (RLS, grants, функции,
триггеры). Фронтенд только отражает их (показывает доступные действия), но никогда не является
единственной защитой. Любой запрос напрямую в Supabase REST/RPC с токеном пользователя должен
давать тот же результат, что и UI.

---

## 2. Стек

| Слой | Выбор |
| --- | --- |
| Сборка | Vite, TypeScript (strict) |
| UI | React 18, Mantine (core, form, notifications, modals, dates не нужен) |
| Роутинг | react-router (v6/v7, data-router не обязателен) |
| Данные | @supabase/supabase-js v2, @tanstack/react-query |
| БД / Auth | Supabase (облако free tier для прода, `supabase` CLI + Docker локально) |
| Тесты фронта | Vitest + @testing-library/react + jsdom |
| Тесты БД | Vitest (отдельный конфиг) против локального Supabase через supabase-js |
| Линт/формат | ESLint (flat config, typescript-eslint, react-hooks) + Prettier |
| Деплой | Vercel (SPA) |

Пакетный менеджер: npm. Один пакет, без монорепы.

---

## 3. Структура репозитория и владение (lanes)

```
/
├─ supabase/
│  ├─ config.toml              # enable_signup = false
│  ├─ migrations/              # *.sql, по порядку
│  └─ seed.sql                 # пустой или только комментарий (данные — через scripts/seed/seed.cli.ts)
├─ scripts/
│  └─ seed.ts                  # создание юзеров, объектов, задач, прогон статусов через RPC
├─ tests/
│  └─ db/                      # интеграционные тесты безопасности БД (Vitest)
├─ src/                        # фронтенд
│  └─ shared/api/database.types.ts   # СГЕНЕРИРОВАН из БД (владелец — backend lane)
├─ docs/
│  ├─ decisions.md             # список решений и допущений (сдача, п.4)
│  └─ for-manager.md           # объяснение для руководителя (сдача, п.3)
├─ vitest.config.ts            # фронт (jsdom), include src/**
├─ vitest.db.config.ts         # БД (node), include tests/db/**
├─ vercel.json                 # SPA rewrite на /index.html
├─ .env.example
└─ README.md
```

**Backend lane** (backend-developer / backend-code-reviewer / backend-test-writer):
`supabase/**`, `scripts/**`, `tests/db/**`, `vitest.db.config.ts`,
`src/shared/api/database.types.ts` (только генерация командой
`supabase gen types typescript --local > src/shared/api/database.types.ts`).

**Frontend lane**: всё остальное в `src/**`, `index.html`, `vite.config.ts`, `vitest.config.ts`,
`vercel.json`.

**Общие корневые файлы** (`package.json`, `tsconfig*.json`, ESLint/Prettier конфиги, `.env.example`,
`.gitignore`, `README.md`, `docs/**`): создаются на шаге 0 (scaffold) одним агентом
(frontend-developer). Дальше backend lane может только **добавлять** свои скрипты/зависимости
в `package.json`, не трогая чужие. `README.md` и `docs/**` дописываются на финальном шаге.

Фронтенд не ждёт backend: контракт БД полностью задан в разделе 5. До появления
сгенерированного `database.types.ts` фронт пишет доменные типы руками по разделу 5 в своих
`*.type.ts` файлах; клиент supabase типизируется сгенерированным типом, как только тот появится.

### Журнал прогресса

`docs/progress.md` — обязателен. После каждого шага §13 (и любого изменения поведения) до
коммита добавляется запись сверху: дата, шаг, что сделано, решения/отклонения от спецификации,
состояние гейтов, что открыто. Ведёт оркестратор по отчётам агентов.

### Конвенции кода (глобальные правила пользователя, обязательны)

- ESLint `padding-line-between-statements`:
  `{ blankLine: 'always', prev: 'block-like', next: '*' }`,
  `{ blankLine: 'always', prev: ['const','let','var'], next: '*' }`,
  `{ blankLine: 'any', prev: ['const','let','var'], next: ['const','let','var'] }`.
- Модульные константы — только в `*.constants.ts`; типы — в `*.type.ts`; интерфейсы — в
  `*.interfaces.ts`. Не объявлять инлайн в файлах реализации (исключение — тестовые хелпер-типы
  внутри spec-файла).
- Файлы с общим префиксом внутри модуля группируются в подпапку с именем префикса
  (`task-actions.ts` + `task-actions.spec.ts` → `task-actions/`). Spec лежит рядом с тестируемым
  файлом. Файлы с именем самого модуля остаются в корне модуля.
- Никаких `any`; ошибки Supabase не глотать.

---

## 4. Роли и пользователи

| Роль (enum `user_role`) | Отображение | Права |
| --- | --- | --- |
| `manager` | Постановщик | CRUD объектов и задач; назначает исполнителя; принимает / возвращает на доработку; видит всё |
| `executor` | Исполнитель | видит только свои задачи и объекты, где у него есть задачи; берёт в работу, отправляет на проверку |

- Постановщиков и исполнителей может быть несколько. Все постановщики равноправны: любой
  постановщик может редактировать/удалять/принимать задачи любого другого постановщика.
- Регистрация отключена (`supabase/config.toml`: `[auth] enable_signup = false`; при этом
  `[auth.email] enable_signup = true` — этот ключ включает сам email-провайдер, без него не
  работает вход по паролю; в облаке —
  Authentication → Providers → Email → «Allow new users to sign up» выключено).
- Пользователи создаются только через Admin API (`scripts/seed/`) или Dashboard.
- Роль берётся из `auth.users.raw_app_meta_data->>'role'` (app_metadata пользователь изменить не
  может, в отличие от user_metadata). Имя — из `raw_user_meta_data->>'full_name'`.
- Если роль не указана или невалидна — `executor` (минимальные права). Повысить до `manager` можно
  только SQL-ом/сервисным ключом.

---

## 5. Модель данных (контракт)

Все таблицы в схеме `public`. Служебные `SECURITY DEFINER`-хелперы — в схеме `private`
(не экспонируется через API). Все функции — `set search_path = ''`, полные имена объектов.

### 5.1. Enum-ы

```sql
create type public.user_role   as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'on_review', 'accepted', 'rework');
```

| `task_status` | Отображение |
| --- | --- |
| `new` | Новая |
| `in_progress` | В работе |
| `on_review` | На проверке |
| `accepted` | Принята |
| `rework` | На доработке |

### 5.2. `profiles`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | uuid | PK, FK → `auth.users(id)` on delete cascade |
| `full_name` | text | not null, 1..200 символов (trim) |
| `role` | user_role | not null, default `'executor'` |
| `created_at` | timestamptz | not null, default `now()` |

Создаётся триггером `AFTER INSERT ON auth.users` (security definer). `full_name` по умолчанию —
email, если имя не передано.

### 5.3. `objects`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |
| `name` | text | not null, check длина trim 1..200 |
| `address` | text | not null, check длина trim 1..500 |
| `created_by` | uuid | not null, FK → profiles(id), default `auth.uid()` |
| `created_at` | timestamptz | not null, default `now()` |
| `updated_at` | timestamptz | not null, default `now()`, обновляется триггером |

### 5.4. `tasks`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |
| `object_id` | uuid | not null, FK → objects(id) **on delete cascade** |
| `title` | text | not null, check длина trim 1..200 |
| `description` | text | not null, default `''`, check длина ≤ 5000 |
| `assignee_id` | uuid | not null, FK → profiles(id) (restrict); профиль обязан иметь роль `executor` (триггер) |
| `status` | task_status | not null, default `'new'` |
| `author_id` | uuid | not null, FK → profiles(id), default `auth.uid()` |
| `created_at` | timestamptz | not null, default `now()` |
| `updated_at` | timestamptz | not null, default `now()`, обновляется триггером |

Индексы: `tasks(object_id)`, `tasks(assignee_id)`.

### 5.5. `task_status_history`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | bigint | PK, generated always as identity |
| `task_id` | uuid | not null, FK → tasks(id) **on delete cascade** |
| `from_status` | task_status | null (null только для записи создания) |
| `to_status` | task_status | not null |
| `changed_by` | uuid | not null, FK → profiles(id) |
| `changed_at` | timestamptz | not null, default `now()` |
| `comment` | text | null, check длина ≤ 2000 |

Индекс: `task_status_history(task_id, changed_at)`.

Запись создания (`null → new`) пишется триггером `AFTER INSERT ON tasks`.

### 5.6. RPC: `public.change_task_status`

```sql
public.change_task_status(p_task_id uuid, p_to_status public.task_status, p_comment text default null)
  returns public.tasks
  language plpgsql security definer set search_path = ''
```

- `EXECUTE` выдан только `authenticated`; отозван у `public` и `anon`.
- Алгоритм (одна транзакция):
  1. `auth.uid()` null → `NOT_AUTHENTICATED`.
  2. `select ... from tasks where id = p_task_id for update`. Нет строки **или** вызывающий не
     имеет права видеть задачу (правило видимости из 6.2) → `TASK_NOT_FOUND` (не раскрываем
     существование чужой задачи).
  3. Комментарий нормализуется: `nullif(trim(p_comment), '')`.
  4. Пара (`old.status`, `p_to_status`) должна быть в матрице 5.7, иначе `INVALID_TRANSITION`.
  5. Проверка актора по матрице: для executor-переходов — `auth.uid() = assignee_id` и роль
     `executor`; для manager-переходов — роль `manager`. Иначе `NOT_ALLOWED`.
  6. `on_review → rework` без комментария → `COMMENT_REQUIRED`.
  7. Обновляет `tasks.status` (с выставлением флага транзакции, см. 7.3), вставляет строку в
     `task_status_history` (`changed_by = auth.uid()`, `comment`), возвращает обновлённую задачу.
- Комментарий опционален для всех остальных переходов; если передан — сохраняется.
- Конкурентность: `for update` сериализует параллельные вызовы; второй получит
  `INVALID_TRANSITION`, т.к. статус уже изменился.

### 5.7. Матрица переходов

| Из | В | Кто | Условие |
| --- | --- | --- | --- |
| — | `new` | manager | при создании задачи (INSERT), не через RPC |
| `new` | `in_progress` | назначенный исполнитель | — |
| `in_progress` | `on_review` | назначенный исполнитель | — |
| `on_review` | `accepted` | manager | — |
| `on_review` | `rework` | manager | комментарий обязателен |
| `rework` | `in_progress` | назначенный исполнитель | — |

Всё остальное запрещено. `accepted` — финальный статус. Постановщик **не может** выполнять
переходы исполнителя и наоборот.

### 5.8. Коды ошибок

Все бизнес-ошибки БД бросаются как `raise exception '<CODE>' using errcode = 'P0001'`
(для `TASK_NOT_FOUND` допустимо `errcode = 'P0002'`). `message` — ровно код из таблицы.
Фронтенд маппит код → русский текст (`*.constants.ts`); неизвестная ошибка → «Не удалось
выполнить действие».

| Код | Где | Текст для UI |
| --- | --- | --- |
| `NOT_AUTHENTICATED` | RPC | Сессия истекла, войдите снова |
| `TASK_NOT_FOUND` | RPC | Задача не найдена |
| `INVALID_TRANSITION` | RPC, триггер | Этот переход статуса недоступен |
| `NOT_ALLOWED` | RPC | Недостаточно прав для этого действия |
| `COMMENT_REQUIRED` | RPC | Укажите комментарий |
| `STATUS_CHANGE_FORBIDDEN` | триггер | Статус меняется только через действия задачи |
| `TASK_ACCEPTED_READONLY` | триггер | Принятую задачу нельзя изменить |
| `ASSIGNEE_NOT_EXECUTOR` | триггер | Исполнителем может быть только пользователь с ролью «Исполнитель» |
| `IMMUTABLE_FIELD` | триггер | Поле нельзя изменить |

Ошибки RLS/grants (`42501`, пустой результат) — штатные ответы PostgREST, не переопределяются.

---

## 6. Права доступа (RLS + grants)

RLS включён на **всех** таблицах `public`. У `anon` нет никаких прав на таблицы и функции.

### 6.1. Хелперы (схема `private`, security definer, stable)

- `private.current_user_role() returns public.user_role` — роль из `profiles` для `auth.uid()`.
- `private.is_manager() returns boolean`.
- `private.can_view_task(task_id uuid) returns boolean` — manager ИЛИ `assignee_id = auth.uid()`.
- `private.can_view_object(object_id uuid) returns boolean` — manager ИЛИ существует задача в
  объекте с `assignee_id = auth.uid()`.

Хелперы нужны, чтобы политики не рекурсировали друг через друга (objects ↔ tasks).
`EXECUTE` на схему/функции — только `authenticated`.

### 6.2. Матрица доступа

| Таблица | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | все `authenticated` | — | — | — |
| `objects` | `can_view_object(id)` | manager | manager | manager |
| `tasks` | `can_view_task(id)` | manager | manager (только разрешённые колонки, 7.2) | manager |
| `task_status_history` | `can_view_task(task_id)` | — | — | — |

«—» = нет политики и нет grant-а для `authenticated`. История пишется только security
definer-кодом (RPC и триггер создания).

### 6.3. Grants (column-level)

- `objects`: `insert (name, address)`, `update (name, address)`, `select`, `delete` для
  `authenticated`.
- `tasks`: `insert (object_id, title, description, assignee_id)`,
  `update (object_id, title, description, assignee_id)`, `select`, `delete` для `authenticated`.
  Колонки `status`, `author_id`, `created_at`, `updated_at`, `id` клиент записать не может.
- `task_status_history`: только `select` для `authenticated`.
- `profiles`: только `select` для `authenticated` (исполнитель не может повысить себе роль).

---

## 7. Защита в глубину (триггеры)

Пользователь выбрал «оба слоя»: RPC — единственный API смены статуса, триггеры — страховка
даже от вызовов с правами `service_role` / владельца.

### 7.1. `tasks` BEFORE INSERT

- `status := 'new'` (принудительно), `author_id := auth.uid()` если вызов от пользователя
  (при `auth.uid() is null`, т.е. service_role, — допускается явный `author_id`, но он должен
  указывать на manager), `created_at/updated_at := now()`.
- `assignee_id` должен ссылаться на профиль с ролью `executor`, иначе `ASSIGNEE_NOT_EXECUTOR`.

### 7.2. `tasks` BEFORE UPDATE

- `old.status = 'accepted'` → `TASK_ACCEPTED_READONLY` (любое изменение).
- Изменение `id`, `author_id`, `created_at` → `IMMUTABLE_FIELD`.
- Смена `assignee_id` → новый исполнитель обязан быть `executor` (`ASSIGNEE_NOT_EXECUTOR`).
  Статус при переназначении не меняется.
- Если `new.status is distinct from old.status`:
  - флаг транзакции `current_setting('app.status_change', true) = 'rpc'` не выставлен →
    `STATUS_CHANGE_FORBIDDEN` (блокирует прямой UPDATE даже от service_role);
  - пара не в матрице 5.7 → `INVALID_TRANSITION`.
- `updated_at := now()`.

RPC выставляет флаг через `set_config('app.status_change', 'rpc', true)` (transaction-local)
непосредственно перед UPDATE и сбрасывает после.

### 7.3. `task_status_history`

- BEFORE UPDATE → всегда исключение (`IMMUTABLE_FIELD`), для любой роли.
- DELETE: нет grant-а/политики для API. Единственный путь удаления — каскад при удалении задачи
  (каскадные удаления FK не проверяют grants/RLS). Триггер на DELETE не ставить — он сломает
  каскад.
- Записи вставляются только security definer-функциями; `changed_by` всегда `auth.uid()`
  (подделать автора/время нельзя: колонки не принимаются от клиента).

### 7.4. `objects` BEFORE UPDATE

- `created_by`, `created_at` неизменяемы; `updated_at := now()`.

---

## 8. Фронтенд

### 8.1. Общее

- Язык UI — русский. Даты — `toLocaleString('ru-RU')` в часовом поясе браузера.
- Клиент Supabase создаётся из `import.meta.env.VITE_SUPABASE_URL` и
  `VITE_SUPABASE_ANON_KEY`. Никаких других ключей во фронте.
- Сессия: `supabase.auth` (persist в localStorage, autoRefresh). `AuthProvider` держит
  `session` + загруженный `profile` (id, full_name, role).
- Все запросы — через TanStack Query; после мутаций инвалидировать затронутые ключи
  (объект, список задач объекта, задача, история, «мои задачи»).
- Ошибки — Mantine notifications с текстом по коду (5.8).
- Шапка: имя, роль, ссылки по роли, кнопка «Выйти».

### 8.2. Маршруты

| Путь | Доступ | Экран |
| --- | --- | --- |
| `/login` | гость | Вход по email/паролю |
| `/` | авторизован | редирект: manager → `/objects`, executor → `/my-tasks` |
| `/objects` | оба | Список объектов |
| `/objects/:objectId` | оба | Карточка объекта со списком задач |
| `/tasks/:taskId` | оба | Карточка задачи |
| `/my-tasks` | executor | Мои задачи |
| `*` | — | «Страница не найдена» |

Неавторизованный → `/login` (с возвратом на исходный путь после входа). Авторизованный на
`/login` → `/`. Manager на `/my-tasks` → редирект на `/objects`. Если объект/задача не
найдены (RLS вернул пусто) — «Не найдено или нет доступа».

### 8.3. Экраны

1. **Вход.** Email + пароль, валидация непустых полей, ошибка «Неверный email или пароль».
   Ссылки на регистрацию нет.
2. **Список объектов.** Таблица: название, адрес, кол-во задач (видимых пользователю). Клик →
   карточка. Manager: кнопка «Создать объект» (модалка: название, адрес). Executor видит только
   объекты со своими задачами; пустое состояние — «У вас пока нет объектов».
3. **Карточка объекта.** Название, адрес. Manager: «Редактировать» (модалка), «Удалить» —
   подтверждение с текстом «Будет удалено задач: N. Действие необратимо» (N — число задач
   объекта). Список задач: название, исполнитель, статус (цветной бейдж), дата создания;
   клик → карточка задачи. Manager: «Создать задачу» (модалка: название, описание, исполнитель —
   select из профилей с ролью executor; объект = текущий). Executor видит только свои задачи.
4. **Карточка задачи.** Поля: название, описание, объект (ссылка), исполнитель, статус, автор,
   дата создания. Блок действий (см. 8.4). Manager (если статус ≠ `accepted`): «Редактировать»
   (название, описание, исполнитель, объект), «Удалить» (подтверждение). История: список по
   `changed_at` по возрастанию — дата/время, кто (имя), «из → в» (для создания «Создана»),
   комментарий.
5. **Мои задачи (executor).** Все задачи, где `assignee_id = текущий`: название, объект,
   статус, дата. Фильтр по статусу (SegmentedControl/Select, «Все» по умолчанию). Сортировка:
   `rework`, `new`, `in_progress`, `on_review`, `accepted`, затем по `created_at` desc.

### 8.4. Доступные действия

Чистая функция `getAvailableActions(task, user) → TaskAction[]` (с unit-тестами по всей
матрице 5.7 × роль × свой/чужой исполнитель). UI рендерит ровно её результат.

| Действие | Переход | Видно когда | UI |
| --- | --- | --- | --- |
| «Взять в работу» | `new → in_progress` | executor, `assignee_id = user.id` | кнопка, сразу RPC |
| «Отправить на проверку» | `in_progress → on_review` | executor, свой | кнопка, сразу RPC |
| «Принять» | `on_review → accepted` | manager | кнопка, сразу RPC |
| «Вернуть на доработку» | `on_review → rework` | manager | модалка с обязательным комментарием (trim ≠ '', ≤ 2000) |
| «Возобновить работу» | `rework → in_progress` | executor, свой | кнопка, сразу RPC |

Кнопки блокируются на время запроса. Нет действий — блок не показывается. Последний
комментарий доработки (из истории) показывается исполнителю над блоком действий, когда статус
`rework`.

---

## 9. Seed и тестовые данные

`scripts/seed/seed.cli.ts` (запуск `npm run seed -- --env-file <файл> [--reset] [--yes]`, через `tsx`;
логика — `scripts/seed/seed.ts`, `runSeed`). Читает только из окружения или из файла, явно переданного
через `--env-file` (корневой `.env` сам не читается): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (вход под
демо-пользователями), `SUPABASE_SERVICE_ROLE_KEY`, `SEED_PASSWORD` (общий пароль демо-юзеров).
Не-локальный URL — только с `--yes`.
Идемпотентен: если юзер с email существует — переиспользует; объекты/задачи пересоздаёт только
с флагом `--reset` (удаляет объекты демо, задачи уходят каскадом).

Порядок:
1. Admin API (`auth.admin.createUser`, `email_confirm: true`, `app_metadata.role`,
   `user_metadata.full_name`) создаёт:
   - `manager1@demo.local` — Иван Петров (manager)
   - `manager2@demo.local` — Ольга Смирнова (manager)
   - `executor1@demo.local` — Сергей Кузнецов (executor)
   - `executor2@demo.local` — Алексей Морозов (executor)
2. Логинится как `manager1` (обычный anon-клиент), создаёт 3 объекта и ~8 задач.
3. Двигает статусы **через RPC под нужными пользователями**, чтобы история была настоящей:
   задачи в каждом из статусов `new`, `in_progress`, `on_review`, `accepted`, `rework`
   (с комментарием), минимум одна задача прошла цикл `rework → in_progress → on_review`.
   Задачи распределены между обоими исполнителями и всеми объектами; один объект содержит
   задачи обоих исполнителей (для демонстрации, что исполнитель видит только свои).

Service role используется только для шага 1. Seed не обходит бизнес-правила.

---

## 10. Тестирование

### 10.1. Тесты БД (`tests/db/**/*.test.ts`, `npm run test:db`)

Предусловие: `supabase start` + `supabase db reset`. Env из `.env.test.local` (gitignored):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (локальные значения из
`supabase status`). Фикстуры создаются в `beforeAll` (admin API для юзеров, далее — клиенты,
залогиненные под каждым юзером). Каждый файл создаёт свои данные с уникальными суффиксами,
тесты не зависят от seed-скрипта.

Обязательные сценарии (минимум):

**Auth**
- signUp через anon-клиент отклоняется.
- anon (без логина) не читает ни одну таблицу и не вызывает RPC.

**Profiles**
- executor не может UPDATE своей роли / INSERT профиля.
- роль из `user_metadata` игнорируется (юзер с `user_metadata.role = 'manager'` и без
  app_metadata получает `executor`).

**Видимость**
- executor A видит только свои задачи; задачи B в том же объекте не видны (SELECT по id → пусто).
- executor видит объект только если в нём есть его задача; объект без его задач — не виден.
- executor не видит историю чужой задачи.
- manager видит всё.

**Запись**
- executor не может INSERT/UPDATE/DELETE objects и tasks.
- manager не может записать `status`/`author_id` напрямую (INSERT с `status='accepted'` → задача
  создаётся `new` или запрос отклонён; UPDATE status → ошибка).
- создание задачи пишет историю `null → new` с `changed_by = manager`.
- assignee с ролью manager → `ASSIGNEE_NOT_EXECUTOR`.
- UPDATE/DELETE задачи в `accepted` → `TASK_ACCEPTED_READONLY` (UPDATE); DELETE разрешён.
- после переназначения старый исполнитель теряет доступ, новый получает.

**Переходы (RPC)**
- каждый разрешённый переход из 5.7 проходит у правильного актора и пишет историю.
- каждая запрещённая пара (полный перебор 5×5 минус разрешённые) → `INVALID_TRANSITION`.
- правильный переход неправильным актором (manager делает `new→in_progress`; чужой executor;
  executor делает `on_review→accepted`) → `NOT_ALLOWED` (или `TASK_NOT_FOUND` для чужого
  executor-а, не видящего задачу).
- `on_review → rework` без комментария / с пробелами → `COMMENT_REQUIRED`.
- прямой UPDATE status через service_role → `STATUS_CHANGE_FORBIDDEN`.

**История**
- `authenticated` (обе роли) не может INSERT/UPDATE/DELETE `task_status_history`.
- service_role UPDATE истории → ошибка триггера.
- удаление задачи каскадно удаляет её историю; удаление объекта — задачи и историю.

### 10.2. Тесты фронта (`npm test`)

- `getAvailableActions`: полный перебор статус × роль × свой/чужой.
- Маппинг кодов ошибок → тексты.
- Компонент карточки задачи (с замоканным слоем данных): рендерит ровно доступные действия;
  модалка доработки не отправляется с пустым комментарием.
- Guard-ы маршрутов: гость → `/login`, manager на `/my-tasks` → `/objects`.

### 10.3. Гейты (должны быть зелёными перед коммитом)

`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` (при поднятом локальном
Supabase), `npm run build`.

---

## 11. Окружение, секреты, деплой

- `.env.example`: `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=` (для фронта);
  `SUPABASE_URL=`, `SUPABASE_SERVICE_ROLE_KEY=`, `SEED_PASSWORD=` (только для скриптов, с
  комментарием «никогда не префиксовать VITE_, не коммитить»).
- `.gitignore`: `.env`, `.env.*` кроме `.env.example`, `supabase/.temp`, `supabase/.branches`.
- Seed-скрипт падает с ошибкой, если найдёт service role key в переменной с префиксом
  `VITE_`.
- Облачный проект уже создан: project ref `fxvcwxsumzwewmzjzoua`,
  `https://fxvcwxsumzwewmzjzoua.supabase.co`, БД
  `postgresql://postgres:[PASSWORD]@db.fxvcwxsumzwewmzjzoua.supabase.co:5432/postgres`.
  Пароль БД — только в локальном `.env` (gitignored), в репо и промпты агентов не попадает.
- Облако: `supabase link --project-ref fxvcwxsumzwewmzjzoua` → `supabase db push`; регистрация
  выключена в Dashboard; `npm run seed` с облачными env локально. До шага 7 агенты работают
  только с локальным Supabase (Docker); облачную БД не трогают.
- Vercel: env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; `vercel.json` с rewrite всех путей
  на `/index.html`. В Supabase Auth → URL Configuration добавить домен Vercel в Site URL.

---

## 12. Решения и допущения (зафиксированы, перенести в `docs/decisions.md`)

1. Смена статуса — только RPC `change_task_status`; прямой UPDATE статуса блокируется grants
   и триггером (защита в два слоя, работает даже против service_role).
2. Постановщик редактирует задачу (название, описание, исполнитель, объект) в любом статусе,
   кроме «Принята». Принятая задача неизменяема, но может быть удалена.
3. Удаление задачи — в любом статусе; история удаляется вместе с задачей (это не изменение
   истории, а удаление сущности целиком). Через API историю удалить/изменить нельзя.
4. Удаление объекта — каскадом вместе с задачами и их историей, с подтверждением в UI
   «будет удалено N задач».
5. Исполнитель обязателен при создании задачи и должен иметь роль «Исполнитель».
6. Переназначение исполнителя не меняет статус и не пишется в историю (история — только
   статусы, как в ТЗ). Новый исполнитель продолжает с текущего статуса; старый теряет доступ.
7. Все постановщики равноправны (видят и меняют задачи друг друга).
8. Постановщик не может выполнять переходы исполнителя (например, сам взять задачу в работу).
9. «Принята» — финальный статус, повторного открытия нет.
10. Комментарий можно передать к любому переходу (API), в UI поле есть только у «Вернуть на
    доработку», где оно обязательно.
11. Роль хранится в `app_metadata` (изменяема только сервером) и копируется в `profiles` при
    создании пользователя; по умолчанию — «Исполнитель».
12. Список пользователей (имя + роль, без email) виден всем авторизованным — нужен для имён в
    истории и выбора исполнителя. Email не хранится в `profiles`.
13. Попытка выполнить действие над невидимой задачей возвращает «не найдена», а не «нет прав»,
    чтобы не раскрывать существование чужих задач.
14. Не делали (вне объёма 2–3 ч): пагинация и поиск, realtime-обновления, загрузка файлов/фото,
    аудит изменения полей задачи, сроки/приоритеты, управление пользователями из UI,
    восстановление пароля.

---

## 13. План работ для агентов

Каждый шаг — полный цикл: architect → test-writer(ы) → developer(ы) → reviewer(ы) → гейты.
Backend и frontend lane-ы параллельны везде, где не указано иное.

| # | Шаг | Lane | Готово, когда |
| --- | --- | --- | --- |
| 0 | Scaffold: Vite+React+TS, Mantine, Query, Router, ESLint/Prettier (с padding-правилом), Vitest оба конфига, `supabase init`, `.env.example`, `.gitignore`, `vercel.json`, npm-скрипты | frontend (корень) + backend (`supabase init`, `vitest.db.config.ts`) — **последовательно**: сначала frontend scaffold, затем backend, т.к. общий `package.json` | `lint`, `typecheck`, `build` зелёные на пустом приложении |
| 1 | Миграции: enum-ы, таблицы, хелперы, RLS, grants, триггеры, RPC; генерация `database.types.ts`; тесты БД (10.1) | backend | `test:db` зелёный |
| 2 | Auth + layout + guard-ы + маршруты-заглушки + маппинг ошибок + `getAvailableActions` | frontend (параллельно с 1, по контракту раздела 5) | unit-тесты зелёные |
| 3 | Seed-скрипт (9) | backend | `npm run seed` на чистой локальной БД создаёт данные; повторный запуск не падает |
| 4 | Экраны объектов (8.3 п.2–3) | frontend | создание/редактирование/удаление работает против локальной БД |
| 5 | Карточка задачи, действия, история, «Мои задачи» (8.3 п.4–5, 8.4) | frontend | весь цикл статусов проходится в UI обеими ролями |
| 6 | README (запуск локально, тесты, деплой, демо-доступы), `docs/decisions.md`, `docs/for-manager.md` (полстраницы, без терминов: как устроено, как защищены данные, чего не может исполнитель) | docs, без ревьюера | — |
| 7 | Деплой: облачный проект, `db push`, seed, Vercel; ручная проверка в обход UI (curl с токеном исполнителя) | вручную пользователем | приложение доступно по ссылке |
