# Мини-CRM «Объекты и задачи»

Небольшая CRM для строительной компании. Постановщик ведёт объекты (стройки) и ставит по ним
задачи, исполнитель берёт задачу в работу и отправляет её на проверку. Каждая смена статуса и
каждая правка задачи попадают в историю; удаление идёт через корзину с восстановлением.

- Стек: React 18, TypeScript, Mantine, TanStack Query, react-router и Supabase (Postgres, Auth,
  PostgREST).
- Все правила доступа и переходы статусов проверяет база (RLS, grants, триггеры, RPC).
  Интерфейс только показывает доступные действия.

Документы:
- [docs/decisions.md](docs/decisions.md): решения и допущения, что не сделано;
- [docs/for-manager.md](docs/for-manager.md): объяснение для руководителя без терминов;
- [spec/SPEC.md](spec/SPEC.md): полная спецификация;
- [docs/progress.md](docs/progress.md): журнал работ.

## Демо-доступы

Пароль один для всех демо-пользователей. Его задаёт переменная `SEED_PASSWORD` при запуске
seed-скрипта.

| Email | Имя | Роль |
| --- | --- | --- |
| `manager1@demo.local` | Иван Петров | Постановщик |
| `manager2@demo.local` | Ольга Смирнова | Постановщик |
| `executor1@demo.local` | Сергей Кузнецов | Исполнитель |
| `executor2@demo.local` | Алексей Морозов | Исполнитель |

Seed создаёт 3 объекта и 8 задач во всех статусах. Одна задача прошла цикл «на доработке → в
работе → на проверке». В объекте «ЖК «Северный парк», корпус 2» есть задачи обоих исполнителей, на нём
видно, что исполнитель видит только свои задачи.

## Требования

- Node.js 20.19+ (проверено на 22).
- Docker Desktop: для локального Supabase.
- Supabase CLI ставится вместе с зависимостями (`npx supabase …`).

## Запуск локально

```bash
npm install
npx supabase start          # поднимает Postgres, Auth, PostgREST, Studio; применяет миграции
npx supabase status         # URL API и ключи (anon, service_role)
```

Создайте два файла (оба в `.gitignore`), значения возьмите из `npx supabase status`:

```bash
# .env.local — для фронтенда
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key>

# .env.seed.local — для seed-скрипта
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SEED_PASSWORD=<пароль демо-пользователей>
```

```bash
npm run seed -- --env-file .env.seed.local    # демо-пользователи и данные
npm run dev                                   # http://localhost:5173
```

Про seed:
- Повторный запуск безопасен: пользователей он чинит (пароль, роль, имя), данные не дублирует.
- `--reset` пересоздаёт демо-объекты и задачи: физически удаляет их ключом `service_role`
  (в том числе уже лежащие в корзине), задачи и история уходят каскадом.
- Если файла из `--env-file` нет, Node падает раньше скрипта (exit 9). Проверьте путь.

Ключ `service_role` нужен только seed-скрипту. Никогда не кладите его в переменные `VITE_*`:
они попадают в браузер. Seed проверяет это сам и отказывается работать.

## Тесты и проверки

```bash
npm run lint
npm run typecheck
npm test            # фронтенд (Vitest + jsdom, слой данных замокан)
npm run test:db     # база: RLS, переходы, история, seed — нужен запущенный локальный Supabase
npm run build
```

`npm run test:db` читает `.env.test.local` (gitignored, переменные `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` из `npx supabase status`). С облачным URL он
работать откажется. После тестов БД пароль локальных демо-пользователей меняется на тестовый,
поэтому перезапустите `npm run seed`.

Если изменилась схема, перегенерируйте типы: `npm run gen:types`.

## Структура

```
supabase/migrations/   схема, хелперы доступа, RLS-политики, триггеры, RPC (смена статуса, корзина), история правок
supabase/config.toml   локальный стек; регистрация выключена
scripts/seed/          seed-скрипт (Admin API для пользователей, остальное — через RPC под ролями)
tests/db/              тесты базы против локального Supabase
src/                   фронтенд; модули по доменам: auth, objects, tasks, profiles, shared, app
```

## Деплой

1. **База (облачный Supabase).**
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   В Dashboard откройте Authentication → Providers → Email и выключите «Allow new users to sign
   up».
2. **Демо-данные.** Создайте файл вроде `.env.seed.cloud` (gitignored) с облачными
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_PASSWORD` и
   запустите:
   ```bash
   npm run seed -- --env-file .env.seed.cloud --yes
   ```
   Без `--yes` seed в не-локальную базу не пишет.
3. **Фронтенд (Vercel).** Импортируйте репозиторий и задайте env `VITE_SUPABASE_URL` и
   `VITE_SUPABASE_ANON_KEY`. `vercel.json` уже отправляет все пути на SPA. В Supabase →
   Authentication → URL Configuration укажите домен Vercel в Site URL.

## Проверка защиты в обход интерфейса

Получите токен исполнителя и попробуйте сделать запрещённое напрямую через API:

```bash
URL=https://<project>.supabase.co; KEY=<anon key>
TOKEN=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"executor1@demo.local","password":"<пароль>"}' | jq -r .access_token)

# видны только свои задачи
curl -s "$URL/rest/v1/tasks?select=title,status" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"

# физическое удаление запрещено (42501); поддерживаемое удаление: RPC soft_delete_task (постановщик)
curl -s -X DELETE "$URL/rest/v1/tasks?id=eq.<id>" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"

# прямая запись статуса запрещена (42501)
curl -s -X PATCH "$URL/rest/v1/tasks?id=eq.<id>" -H "apikey: $KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"accepted"}'

# переход «Новая → Принята» через RPC: INVALID_TRANSITION
curl -s -X POST "$URL/rest/v1/rpc/change_task_status" -H "apikey: $KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"p_task_id":"<id>","p_to_status":"accepted"}'

# историю изменить нельзя (42501)
curl -s -X DELETE "$URL/rest/v1/task_status_history?id=gt.0" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "$URL/rest/v1/task_field_history?id=gt.0" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"

# исполнитель не может удалять в корзину: NOT_ALLOWED
curl -s -X POST "$URL/rest/v1/rpc/soft_delete_task" -H "apikey: $KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"p_task_id":"<id>"}'
```

То же с токеном постановщика: `POST /rest/v1/rpc/soft_delete_task` отправляет задачу в корзину
(поддерживаемый способ удаления), а `DELETE /rest/v1/tasks` по-прежнему даёт 42501.
