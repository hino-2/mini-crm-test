import { describe, expect, it } from 'vitest';

import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from './tasks.constants';

describe('§5.1 task_status display labels', () => {
  it('TASK_STATUS_LABELS: Новая / В работе / На проверке / Принята / На доработке', () => {
    expect(TASK_STATUS_LABELS).toEqual({
      new: 'Новая',
      in_progress: 'В работе',
      on_review: 'На проверке',
      accepted: 'Принята',
      rework: 'На доработке',
    });
  });
});

describe('§8.3.3 status badge colors', () => {
  it('TASK_STATUS_COLORS: blue / yellow / violet / green / red', () => {
    expect(TASK_STATUS_COLORS).toEqual({
      new: 'blue',
      in_progress: 'yellow',
      on_review: 'violet',
      accepted: 'green',
      rework: 'red',
    });
  });
});
