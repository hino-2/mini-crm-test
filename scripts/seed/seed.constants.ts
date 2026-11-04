import type { DemoObject, DemoTask, DemoUser } from './seed.type';

export const SEED_REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEED_PASSWORD',
] as const;

export const LOCAL_SUPABASE_HOSTNAMES: readonly string[] = ['127.0.0.1', 'localhost', '[::1]'];

export const VITE_PREFIX = 'VITE_';
export const SECRET_KEY_PREFIX = 'sb_secret_';
export const SERVICE_ROLE_JWT_ROLE = 'service_role';

export const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

export const LIST_USERS_PAGE_SIZE = 1000;

export const SEED_USAGE = `Usage: npm run seed -- [--env-file <path>] [--reset] [--yes]

  --env-file <path>  read variables from this file (overrides the environment)
  --reset            delete and recreate demo objects/tasks
  --yes              confirm seeding a non-local Supabase project`;

export const REWORK_COMMENT_ARMATURE =
  'Шаг хомутов в зоне стыка не соответствует проекту (должен быть 100 мм). Переделать и приложить фото.';
export const RESUBMIT_COMMENT_ARMATURE = 'Хомуты переставлены с шагом 100 мм, фото приложены.';
export const REWORK_COMMENT_ROOF =
  'На примыканиях к парапету нахлёст рулонов меньше 150 мм. Устранить и сдать повторно.';

export const DEMO_USERS: readonly DemoUser[] = [
  { key: 'manager1', email: 'manager1@demo.local', fullName: 'Иван Петров', role: 'manager' },
  { key: 'manager2', email: 'manager2@demo.local', fullName: 'Ольга Смирнова', role: 'manager' },
  {
    key: 'executor1',
    email: 'executor1@demo.local',
    fullName: 'Сергей Кузнецов',
    role: 'executor',
  },
  {
    key: 'executor2',
    email: 'executor2@demo.local',
    fullName: 'Алексей Морозов',
    role: 'executor',
  },
];

export const DEMO_OBJECTS: readonly DemoObject[] = [
  {
    key: 'northPark',
    name: 'ЖК «Северный парк», корпус 2',
    address: 'г. Москва, ул. Лётчика Бабушкина, вл. 39',
  },
  {
    key: 'galaxy',
    name: 'Бизнес-центр «Галактика»',
    address: 'г. Москва, Варшавское шоссе, д. 118, стр. 1',
  },
  {
    key: 'pineForest',
    name: 'Частный дом, КП «Сосновый бор»',
    address: 'Московская обл., Истринский р-н, д. Покровское, ул. Сосновая, уч. 14',
  },
];

export const DEMO_TASKS: readonly DemoTask[] = [
  {
    objectKey: 'northPark',
    assigneeKey: 'executor1',
    title: 'Монтаж опалубки перекрытия 5-го этажа',
    description:
      'Смонтировать щитовую опалубку перекрытия 5-го этажа по ППР, проверить отметки нивелиром.',
    steps: [
      { actor: 'executor1', to: 'in_progress' },
      { actor: 'executor1', to: 'on_review' },
      { actor: 'manager1', to: 'accepted' },
    ],
  },
  {
    objectKey: 'northPark',
    assigneeKey: 'executor2',
    title: 'Армирование колонн 6-го этажа',
    description:
      'Выполнить армирование колонн 6-го этажа (оси 1–8) по рабочим чертежам КЖ, шаг хомутов в зоне стыка 100 мм.',
    steps: [
      { actor: 'executor2', to: 'in_progress' },
      { actor: 'executor2', to: 'on_review' },
      { actor: 'manager2', to: 'rework', comment: REWORK_COMMENT_ARMATURE },
      { actor: 'executor2', to: 'in_progress' },
      { actor: 'executor2', to: 'on_review', comment: RESUBMIT_COMMENT_ARMATURE },
    ],
  },
  {
    objectKey: 'northPark',
    assigneeKey: 'executor1',
    title: 'Гидроизоляция кровли, секция А',
    description:
      'Устроить наплавляемую гидроизоляцию кровли секции А в два слоя с заводом на парапет 250 мм.',
    steps: [
      { actor: 'executor1', to: 'in_progress' },
      { actor: 'executor1', to: 'on_review' },
      { actor: 'manager1', to: 'rework', comment: REWORK_COMMENT_ROOF },
    ],
  },
  {
    objectKey: 'galaxy',
    assigneeKey: 'executor2',
    title: 'Демонтаж перегородок на 3-м этаже',
    description:
      'Демонтировать гипсокартонные перегородки 3-го этажа, вывезти мусор, освободить площадку под перепланировку.',
    steps: [
      { actor: 'executor2', to: 'in_progress' },
      { actor: 'executor2', to: 'on_review' },
      { actor: 'manager2', to: 'accepted' },
    ],
  },
  {
    objectKey: 'galaxy',
    assigneeKey: 'executor2',
    title: 'Прокладка кабельных трасс в серверной',
    description:
      'Смонтировать кабельные лотки и проложить силовые и слаботочные линии в серверной на 3-м этаже.',
    steps: [{ actor: 'executor2', to: 'in_progress' }],
  },
  {
    objectKey: 'galaxy',
    assigneeKey: 'executor2',
    title: 'Монтаж приточной вентиляции, 3-й этаж',
    description: 'Смонтировать воздуховоды приточной системы П1 на 3-м этаже согласно разделу ОВ.',
    steps: [],
  },
  {
    objectKey: 'pineForest',
    assigneeKey: 'executor1',
    title: 'Устройство ленточного фундамента',
    description:
      'Выполнить армирование и бетонирование ленточного фундамента (бетон B25), уход за бетоном 7 суток.',
    steps: [
      { actor: 'executor1', to: 'in_progress' },
      { actor: 'executor1', to: 'on_review' },
    ],
  },
  {
    objectKey: 'pineForest',
    assigneeKey: 'executor1',
    title: 'Монтаж кровли из металлочерепицы',
    description:
      'Смонтировать стропильную систему и кровлю из металлочерепицы с подкладочным ковром.',
    steps: [],
  },
];
