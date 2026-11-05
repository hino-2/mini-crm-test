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
| Деплой | Netlify (SPA) |

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
├─ netlify.toml                # сборка + SPA rewrite на /index.html
├─ .env.example
└─ README.md
```

**Backend lane** (backend-developer / backend-code-reviewer / backend-test-writer):
`supabase/**`, `scripts/**`, `tests/db/**`, `vitest.db.config.ts`,
`src/shared/api/database.types.ts` (только генерация командой
`supabase gen types typescript --local > src/shared/api/database.types.ts`).

**Frontend lane**: всё остальное в `src/**`, `index.html`, `vite.config.ts`, `vitest.config.ts`,
`netlify.toml`.

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
| `deleted_at` | timestamptz | null; не null = объект в корзине (мягкое удаление); пишется только RPC |
| `deleted_by` | uuid | null, FK → profiles(id); кто отправил в корзину; пишется только RPC |

### 5.4. `tasks`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |
| `object_id` | uuid | not null, FK → objects(id) **on delete cascade** (каскад только при физическом удалении service_role); после создания неизменяем |
| `title` | text | not null, check длина trim 1..200 |
| `description` | text | not null, default `''`, check длина ≤ 5000 |
| `assignee_id` | uuid | not null, FK → profiles(id) (restrict); профиль обязан иметь роль `executor` (триггер) |
| `status` | task_status | not null, default `'new'` |
| `author_id` | uuid | not null, FK → profiles(id), default `auth.uid()` |
| `created_at` | timestamptz | not null, default `now()` |
| `updated_at` | timestamptz | not null, default `now()`, обновляется триггером |
| `deleted_at` | timestamptz | null; не null = задача в корзине (мягкое удаление); пишется только RPC |
| `deleted_by` | uuid | null, FK → profiles(id); пишется только RPC |

Индексы: `tasks(object_id)`, `tasks(assignee_id)`.

Мягкое удаление: в корзину помечается только строка объекта, его задачи свою `deleted_at` не
получают, а скрыты через `objects.deleted_at` (хелперы 6.1). Поэтому восстановление объекта —
один UPDATE, а задачи, удалённые отдельно, остаются в корзине. Физически строки удаляет только
`service_role` (каскады FK сохранены для этого пути).

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
     имеет права видеть задачу (правило видимости из 6.2; удалённая задача и задача удалённого
     объекта не видны никому) → `TASK_NOT_FOUND` (не раскрываем существование чужой задачи).
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

Всё остальное запрещено. `accepted` — финальный статус (поля принятой задачи при этом
редактируются, см. 7.2). Постановщик **не может** выполнять переходы исполнителя и наоборот.

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
| `ASSIGNEE_NOT_EXECUTOR` | триггер | Исполнителем может быть только пользователь с ролью «Исполнитель» |
| `IMMUTABLE_FIELD` | триггер | Поле нельзя изменить |
| `OBJECT_NOT_FOUND` | RPC удаления/восстановления объекта | Объект не найден |
| `OBJECT_DELETED` | триггер INSERT задачи, RPC `restore_task` | Объект находится в корзине — сначала восстановите его |
| `TASK_DELETED` | триггер UPDATE задачи | Задача находится в корзине |

Код `TASK_ACCEPTED_READONLY` удалён: принятые задачи редактируются. `TASK_NOT_FOUND`,
`NOT_ALLOWED`, `NOT_AUTHENTICATED` также бросают RPC из 5.10.

Ошибки RLS/grants (`42501`, пустой результат) — штатные ответы PostgREST, не переопределяются.

### 5.9. `task_field_history`

Неизменяемый журнал правок полей задачи (аудит, чтобы не было споров «кто и когда поменял»).

```sql
create type public.task_field as enum ('title', 'description', 'assignee_id', 'deleted_at');
```

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | bigint | PK, generated always as identity |
| `task_id` | uuid | not null, FK → tasks(id) **on delete cascade** |
| `field` | task_field | not null |
| `old_value` | text | null |
| `new_value` | text | null |
| `changed_by` | uuid | null, FK → profiles(id); null = системная правка (service_role / Dashboard) |
| `changed_at` | timestamptz | not null, default `now()` |

Индекс: `task_field_history(task_id, changed_at)`. Значения приводятся к `text`
(`assignee_id` — текст uuid). Отправка задачи в корзину и восстановление пишутся как
`field = 'deleted_at'` (`null → время` = удалена, `время → null` = восстановлена). Удаление и
восстановление объекта в историю задач не пишутся (известное ограничение).

### 5.10. RPC корзины

Все функции: `language plpgsql volatile` (списки — `language sql stable`), `security definer`,
`set search_path = ''`; `EXECUTE` выдан только `authenticated` (отозван у `public`, `anon`,
`service_role`). Не идемпотентны.

| Функция | Результат | Поведение |
| --- | --- | --- |
| `soft_delete_object(p_object_id uuid)` | void | `auth.uid()` null → `NOT_AUTHENTICATED`; не manager → `NOT_ALLOWED`; ставит `deleted_at = now()`, `deleted_by = auth.uid()` у активного объекта; нет такого/уже удалён → `OBJECT_NOT_FOUND` |
| `restore_object(p_object_id uuid)` | void | те же проверки; сбрасывает `deleted_at/deleted_by` у удалённого объекта; иначе `OBJECT_NOT_FOUND`. Задачи, удалённые отдельно, остаются в корзине |
| `soft_delete_task(p_task_id uuid)` | void | те же проверки; `select ... for update`; нет задачи, она уже удалена или её объект удалён → `TASK_NOT_FOUND` |
| `restore_task(p_task_id uuid)` | void | те же проверки; `for update`; нет задачи или она не удалена → `TASK_NOT_FOUND`; объект в корзине → `OBJECT_DELETED` |
| `list_deleted_objects()` | таблица `(id, name, address, deleted_at, deleted_by_name)` | только удалённые объекты; manager, иначе пустой результат без ошибки; сортировка `deleted_at desc, id` |
| `list_deleted_tasks()` | таблица `(id, title, object_id, object_name, object_deleted, deleted_at, deleted_by_name)` | только задачи с собственным `deleted_at`; задачи, скрытые лишь из-за удалённого объекта, не показываются; manager, иначе пусто |

`deleted_by_name` = `null`, если `deleted_by` не задан. Списки — функции, потому что RLS скрывает
удалённое даже от постановщика, а грантов на `deleted_at` у `authenticated` нет.

---

## 6. Права доступа (RLS + grants)

RLS включён на **всех** таблицах `public`. У `anon` нет никаких прав на таблицы и функции.

### 6.1. Хелперы (схема `private`, security definer, stable)

- `private.current_user_role() returns public.user_role` — роль из `profiles` для `auth.uid()`.
- `private.is_manager() returns boolean`.
- `private.can_view_task(task_id uuid) returns boolean` — задача существует, `deleted_at is null`,
  её объект не удалён, и (manager ИЛИ `assignee_id = auth.uid()`). Несуществующий id → false.
- `private.can_view_object(object_id uuid) returns boolean` — объект существует, `deleted_at is
  null`, и (manager ИЛИ существует неудалённая задача в объекте с `assignee_id = auth.uid()`).
  Несуществующий id → false, в том числе для manager.

Хелперы нужны, чтобы политики не рекурсировали друг через друга (objects ↔ tasks).
`EXECUTE` на схему/функции — только `authenticated`.

SELECT-политики `objects` и `tasks` проверяют колонки (`deleted_at`, роль, `assignee_id`)
напрямую, а хелпер вызывают только по объекту (для задачи — `can_view_object(object_id)`).
Причина: хелпер видит snapshot начала оператора, и вызов по только что вставленной строке дал бы
false при `INSERT ... RETURNING`.

### 6.2. Матрица доступа

| Таблица | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | все `authenticated` | — | — | — |
| `objects` | `deleted_at is null` и (manager ИЛИ `can_view_object(id)`) — см. 6.1 | manager | manager (только видимые, не удалённые) | — (мягкое удаление через RPC 5.10) |
| `tasks` | `deleted_at is null` и (manager ИЛИ `assignee_id = auth.uid()`) и `can_view_object(object_id)` — см. 6.1 | manager | manager (только разрешённые колонки, 7.2; только видимые) | — (мягкое удаление через RPC 5.10) |
| `task_status_history` | `can_view_task(task_id)` | — | — | — |
| `task_field_history` | `can_view_task(task_id)` | — | — | — |

«—» = нет политики и нет grant-а для `authenticated`. История пишется только security
definer-кодом (RPC и триггеры). Физически удалять строки может только `service_role`.

### 6.3. Grants (column-level)

- `objects`: `insert (name, address)`, `update (name, address)`, `select` для `authenticated`.
  `delete` не выдан.
- `tasks`: `insert (object_id, title, description, assignee_id)`,
  `update (title, description, assignee_id)`, `select` для `authenticated`. `delete` не выдан.
  Колонки `status`, `author_id`, `created_at`, `updated_at`, `id`, `deleted_at`, `deleted_by` клиент
  записать не может, `object_id` — только при создании.
- `task_status_history`, `task_field_history`: только `select` для `authenticated`.
- `service_role` сохраняет все права (в т.ч. физическое `delete`).
- `profiles`: только `select` для `authenticated` (исполнитель не может повысить себе роль).

---

## 7. Защита в глубину (триггеры)

Пользователь выбрал «оба слоя»: RPC — единственный API смены статуса, триггеры — страховка
даже от вызовов с правами `service_role` / владельца.

### 7.1. `tasks` BEFORE INSERT

- `status := 'new'` (принудительно), `author_id := auth.uid()` если вызов от пользователя
  (при `auth.uid() is null`, т.е. service_role, — допускается явный `author_id`, но он должен
  указывать на manager), `created_at/updated_at := now()`.
- `deleted_at := null`, `deleted_by := null` (задача не может родиться в корзине).
- Объект `new.object_id` в корзине (`deleted_at is not null`) → `OBJECT_DELETED`.
- `assignee_id` должен ссылаться на профиль с ролью `executor`, иначе `ASSIGNEE_NOT_EXECUTOR`.

### 7.2. `tasks` BEFORE UPDATE

Порядок проверок:

1. Изменение `id`, `author_id`, `created_at`, `object_id` → `IMMUTABLE_FIELD`.
2. Правка (`title`, `description`, `assignee_id` или `status` изменились) при `old.deleted_at` или
   `new.deleted_at` не null либо при удалённом объекте задачи → `TASK_DELETED`. Удаление и
   восстановление никогда не смешиваются с правками.
3. Смена `assignee_id` → новый исполнитель обязан быть `executor` (`ASSIGNEE_NOT_EXECUTOR`).
   Статус при переназначении не меняется.
4. Если `new.status is distinct from old.status`:
  - флаг транзакции `current_setting('app.status_change', true) = 'rpc'` не выставлен →
    `STATUS_CHANGE_FORBIDDEN` (блокирует прямой UPDATE даже от service_role);
  - пара не в матрице 5.7 → `INVALID_TRANSITION`.
5. `updated_at := now()`.

Принятая задача (`accepted`) редактируется как любая другая; статус остаётся `accepted`, а повторный
переход из него невозможен (`INVALID_TRANSITION`).

RPC выставляет флаг через `set_config('app.status_change', 'rpc', true)` (transaction-local)
непосредственно перед UPDATE и сбрасывает после.

### 7.3. `task_status_history` и `task_field_history`

Правила одинаковы для обеих таблиц.

- BEFORE UPDATE → всегда исключение (`IMMUTABLE_FIELD`), для любой роли.
- DELETE: нет grant-а/политики для API. Единственный путь удаления — каскад при физическом
  удалении задачи или объекта сервисной ролью (каскадные удаления FK не проверяют grants/RLS).
  Триггер на DELETE не ставить — он сломает каскад.
- Записи вставляются только security definer-функциями; `changed_by` всегда `auth.uid()`
  (подделать автора/время нельзя: колонки не принимаются от клиента).

### 7.4. `objects` BEFORE UPDATE

- `created_by`, `created_at` неизменяемы; `updated_at := now()`.

### 7.5. `tasks` AFTER UPDATE OF title, description, assignee_id, deleted_at

- Триггер (security definer) пишет в `task_field_history` по одной строке на каждое реально
  изменённое поле (`is distinct from`), в порядке `title`, `description`, `assignee_id`,
  `deleted_at`. `changed_by = auth.uid()` (null для service_role), `changed_at = now()` —
  строки одного оператора делят время и идут по возрастанию `id`.
- Пустой UPDATE (те же значения) ничего не пишет. Создание задачи и `change_task_status` в эту
  таблицу не пишут (у них своя история).

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
| `/trash` | manager | Корзина |
| `*` | — | «Страница не найдена» |

Неавторизованный → `/login` (с возвратом на исходный путь после входа). Авторизованный на
`/login` → `/`. Manager на `/my-tasks` → редирект на `/objects`. Executor на `/trash` → редирект
на `/my-tasks`. Если объект/задача не
найдены (RLS вернул пусто) — «Не найдено или нет доступа».

### 8.3. Экраны

1. **Вход.** Email + пароль, валидация непустых полей, ошибка «Неверный email или пароль».
   Ссылки на регистрацию нет.
2. **Список объектов.** Таблица: название, адрес, кол-во задач (видимых пользователю). Клик →
   карточка. Manager: кнопка «Создать объект» (модалка: название, адрес). Executor видит только
   объекты со своими задачами; пустое состояние — «У вас пока нет объектов».
3. **Карточка объекта.** Кнопка «← Назад» слева от заголовка «Карточка объекта» (расположение
   как у карточки задачи, п.4) — переход на список объектов `/objects`; показывается всегда, в том
   числе при «Не найдено или нет доступа». Название, адрес. Manager: «Редактировать» (модалка), «Удалить» —
   подтверждение «Удалить объект?» с текстом «Объект будет перемещён в корзину вместе с задачами:
   N. Восстановить его можно из корзины.» (N — число задач объекта). Список задач: название,
   исполнитель, статус (цветной бейдж), дата создания; клик → карточка задачи. Manager: «Создать задачу» (модалка: название, описание, исполнитель —
   select из профилей с ролью executor; объект = текущий). Executor видит только свои задачи.
4. **Карточка задачи.** Кнопка «← Назад» в одной строке слева от заголовка «Карточка задачи»
   (на широком экране — в левом поле, заголовок остаётся выровнен с содержимым; на узком — над
   заголовком) — переход на карточку объекта задачи; показывается после загрузки задачи.
   Поля: название, описание, объект (ссылка), исполнитель, статус, автор,
   дата создания. Блок действий (см. 8.4). Manager: «Редактировать»
   (название, описание, исполнитель; поля «Объект» нет — объект задачи не меняется) — в любом
   статусе, включая «Принята»; «Удалить» — в любом статусе, подтверждение «Удалить задачу?» с
   текстом «Задача будет перемещена в корзину. Восстановить её можно из корзины.» (см. 12).
   История — единый список, новые записи сверху: слой данных отдаёт его по `changed_at` по
   возрастанию (при равенстве времени сначала смены статуса, затем правки полей, затем по `id`),
   экран показывает в обратном порядке: дата/время, кто (имя; для системных правок
   «Система»), изменение, комментарий. Смена статуса: «из → в» (для создания «Создана»).
   Правка поля: «Изменено поле «Название»: «старое» → «новое»», для исполнителя — имена, для
   описания — «Изменено поле «Описание»» и раскрывающийся блок «Было / Стало». Отправка в корзину
   и восстановление: «Задача перемещена в корзину» / «Задача восстановлена из корзины».
5. **Мои задачи (executor).** Все задачи, где `assignee_id = текущий`: название, объект,
   статус, дата. Фильтр по статусу (SegmentedControl/Select, «Все» по умолчанию). Сортировка:
   `rework`, `new`, `in_progress`, `on_review`, `accepted`, затем по `created_at` desc.
6. **Корзина (manager, `/trash`).** Раздел «Удалённые объекты» (название, адрес, когда и кто
   удалил, кнопка «Восстановить») и раздел «Удалённые задачи» (название, объект, когда и кто
   удалил, «Восстановить»; если объект тоже в корзине — пометка «объект в корзине» и кнопка
   недоступна, сначала восстанавливается объект). Пустые состояния: «Нет удалённых объектов»,
   «Нет удалённых задач». Ссылка «Корзина» в шапке только у постановщика.

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
с флагом `--reset` (физически удаляет объекты демо клиентом `service_role`, задачи и их история
уходят каскадом; найденные мягко удалённые демо-объекты тоже пересоздаются). Поиск существующих
демо-объектов и чтение задач для сводки идут через `service_role`: RLS скрывает удалённое.

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

Service role используется для шага 1, поиска существующих демо-данных и физического удаления при
`--reset`. Создание объектов, задач и смена статусов идут под пользователями: seed не обходит
бизнес-правила.

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
- принятая задача редактируется (название, описание, исполнитель), статус остаётся `accepted`;
  DELETE из API → 42501.
- после переназначения старый исполнитель теряет доступ, новый получает; переназначение пишет
  строку `assignee_id` в `task_field_history`, а `task_status_history` не меняется.
- `object_id` задачи неизменяем: PATCH → 42501, service_role → `IMMUTABLE_FIELD`.

**Мягкое удаление и корзина**
- DELETE из `objects`/`tasks`/обеих таблиц истории для обеих ролей → 42501.
- `soft_delete_task` / `soft_delete_object`: задача/объект, задачи объекта и их история (статусов и
  полей) не видны никому через таблицы; executor теряет объект, где его единственная задача
  удалена; администратор (service_role) их видит.
- `change_task_status` по удалённой задаче или задаче удалённого объекта → `TASK_NOT_FOUND`; PATCH
  менеджера → 0 строк; service_role UPDATE → `TASK_DELETED`; INSERT задачи в удалённый объект →
  `OBJECT_DELETED`.
- Повторное удаление и восстановление активного → `*_NOT_FOUND`; executor → `NOT_ALLOWED`; anon →
  ошибка.
- `list_deleted_objects` / `list_deleted_tasks`: точные колонки, исключают активные записи и задачи,
  скрытые лишь через объект; executor → `[]`.
- `restore_task`: задача и её история снова видны, правки и переходы работают; пока объект в
  корзине → `OBJECT_DELETED`. `restore_object`: возвращает объект и не удалённые отдельно задачи;
  отдельно удалённая задача остаётся в корзине.
- service_role: физическое удаление объекта каскадом удаляет задачи и обе таблицы истории.

**Переходы (RPC)**
- каждый разрешённый переход из 5.7 проходит у правильного актора и пишет историю.
- каждая запрещённая пара (полный перебор 5×5 минус разрешённые) → `INVALID_TRANSITION`.
- правильный переход неправильным актором (manager делает `new→in_progress`; чужой executor;
  executor делает `on_review→accepted`) → `NOT_ALLOWED` (или `TASK_NOT_FOUND` для чужого
  executor-а, не видящего задачу).
- `on_review → rework` без комментария / с пробелами → `COMMENT_REQUIRED`.
- прямой UPDATE status через service_role → `STATUS_CHANGE_FORBIDDEN`.

**История**
- `authenticated` (обе роли) не может INSERT/UPDATE/DELETE `task_status_history` и
  `task_field_history`; anon не читает `task_field_history`.
- service_role UPDATE любой из таблиц истории → `IMMUTABLE_FIELD`.
- физическое удаление задачи/объекта (service_role) каскадно удаляет историю.
- `task_field_history`: правка названия, описания, исполнителя пишет ровно одну строку на поле
  (`changed_by` = автор правки, у service_role — null); один PATCH трёх полей — три строки с одним
  `changed_at` в порядке `id`; PATCH теми же значениями, создание задачи и `change_task_status` —
  0 строк. Видимость такая же, как у истории статусов.

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
- Netlify: env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; `netlify.toml` (сборка `npm run build`,
  публикация `dist`, rewrite всех путей на `/index.html`). В Supabase Auth → URL Configuration
  добавить домен Netlify в Site URL.

---

## 12. Решения и допущения (зафиксированы, перенести в `docs/decisions.md`)

1. Смена статуса — только RPC `change_task_status`; прямой UPDATE статуса блокируется grants
   и триггером (защита в два слоя, работает даже против service_role).
2. Постановщик редактирует задачу (название, описание, исполнитель) в любом статусе, включая
   «Принята». Объект задачи после создания не меняется. Каждая правка фиксируется базой в
   `task_field_history` (аудит), чтобы не было споров между людьми.
3. «Удаление» задачи — мягкое: задача уходит в корзину (`deleted_at`), никому не видна, постановщик
   восстанавливает её из корзины. История сохраняется; отправка в корзину и восстановление пишутся
   в неё как `field = 'deleted_at'`. Физически удаляет только администратор (`service_role`).
4. «Удаление» объекта — мягкое: в корзину уходит строка объекта, его задачи скрыты и возвращаются
   при восстановлении объекта; задачи, удалённые отдельно, остаются в корзине. Задачу нельзя
   восстановить, пока её объект в корзине (`OBJECT_DELETED`). Корзина доступна только
   постановщику (RPC списков, `/trash`).
5. Исполнитель обязателен при создании задачи и должен иметь роль «Исполнитель».
6. Переназначение исполнителя не меняет статус, но записывается в историю правок полей. Новый
   исполнитель продолжает с текущего статуса; старый теряет доступ (и к истории задачи).
7. Все постановщики равноправны (видят и меняют задачи друг друга).
8. Постановщик не может выполнять переходы исполнителя (например, сам взять задачу в работу).
9. «Принята» — финальный статус, повторного открытия нет; поля принятой задачи редактируются
   (с записью в историю).
10. Комментарий можно передать к любому переходу (API), в UI поле есть только у «Вернуть на
    доработку», где оно обязательно.
11. Роль хранится в `app_metadata` (изменяема только сервером) и копируется в `profiles` при
    создании пользователя; по умолчанию — «Исполнитель».
12. Список пользователей (имя + роль, без email) виден всем авторизованным — нужен для имён в
    истории и выбора исполнителя. Email не хранится в `profiles`.
13. Попытка выполнить действие над невидимой задачей возвращает «не найдена», а не «нет прав»,
    чтобы не раскрывать существование чужих задач.
14. Не делали (вне объёма 2–3 ч): пагинация и поиск, realtime-обновления, загрузка файлов/фото,
    сроки/приоритеты, управление пользователями из UI, восстановление пароля, очистка корзины из
    интерфейса, сохранение автора удаления объекта после его восстановления (и запись удаления
    объекта в историю его задач).

---

## 13. План работ для агентов

Каждый шаг — полный цикл: architect → test-writer(ы) → developer(ы) → reviewer(ы) → гейты.
Backend и frontend lane-ы параллельны везде, где не указано иное.

| # | Шаг | Lane | Готово, когда |
| --- | --- | --- | --- |
| 0 | Scaffold: Vite+React+TS, Mantine, Query, Router, ESLint/Prettier (с padding-правилом), Vitest оба конфига, `supabase init`, `.env.example`, `.gitignore`, `netlify.toml`, npm-скрипты | frontend (корень) + backend (`supabase init`, `vitest.db.config.ts`) — **последовательно**: сначала frontend scaffold, затем backend, т.к. общий `package.json` | `lint`, `typecheck`, `build` зелёные на пустом приложении |
| 1 | Миграции: enum-ы, таблицы, хелперы, RLS, grants, триггеры, RPC; генерация `database.types.ts`; тесты БД (10.1) | backend | `test:db` зелёный |
| 2 | Auth + layout + guard-ы + маршруты-заглушки + маппинг ошибок + `getAvailableActions` | frontend (параллельно с 1, по контракту раздела 5) | unit-тесты зелёные |
| 3 | Seed-скрипт (9) | backend | `npm run seed` на чистой локальной БД создаёт данные; повторный запуск не падает |
| 4 | Экраны объектов (8.3 п.2–3) | frontend | создание/редактирование/удаление работает против локальной БД |
| 5 | Карточка задачи, действия, история, «Мои задачи» (8.3 п.4–5, 8.4) | frontend | весь цикл статусов проходится в UI обеими ролями |
| 6 | README (запуск локально, тесты, деплой, демо-доступы), `docs/decisions.md`, `docs/for-manager.md` (полстраницы, без терминов: как устроено, как защищены данные, чего не может исполнитель) | docs, без ревьюера | — |
| 7 | Деплой: облачный проект, `db push`, seed, Netlify; ручная проверка в обход UI (curl с токеном исполнителя) | вручную пользователем | приложение доступно по ссылке |
| 8 | Мягкое удаление и корзина (миграции `soft_delete`, `task_field_history`; `/trash`), неизменяемый `object_id` задачи, редактирование принятых задач, история правок полей; обновление seed и документов | backend + frontend (параллельно по контракту 5.9–5.10) | `test:db` и `npm test` зелёные; корзина и смешанная история работают в UI |
