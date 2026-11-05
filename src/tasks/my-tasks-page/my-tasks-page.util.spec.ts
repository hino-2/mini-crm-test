import { describe, expect, it } from 'vitest';
import type { MyTaskItem, TaskStatus } from '../tasks.type';
import { sortMyTasks } from './my-tasks-page.util';

function task(id: string, status: TaskStatus, created_at: string): MyTaskItem {
  return { id, title: id, status, created_at, object: { name: 'O' } };
}

describe('sortMyTasks', () => {
  it('orders by status rank, then created_at descending', () => {
    const input = [
      task('acc', 'accepted', '2026-01-05T00:00:00Z'),
      task('new-old', 'new', '2026-01-01T00:00:00Z'),
      task('rew', 'rework', '2026-01-02T00:00:00Z'),
      task('rev', 'on_review', '2026-01-03T00:00:00Z'),
      task('new-new', 'new', '2026-01-04T00:00:00Z'),
      task('prog', 'in_progress', '2026-01-06T00:00:00Z'),
    ];

    expect(sortMyTasks(input).map((item) => item.id)).toEqual([
      'rew',
      'new-new',
      'new-old',
      'prog',
      'rev',
      'acc',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [
      task('a', 'accepted', '2026-01-01T00:00:00Z'),
      task('b', 'new', '2026-01-01T00:00:00Z'),
    ];

    sortMyTasks(input);

    expect(input.map((item) => item.id)).toEqual(['a', 'b']);
  });
});
