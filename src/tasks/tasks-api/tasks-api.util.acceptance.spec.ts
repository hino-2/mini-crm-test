import { describe, expect, it } from 'vitest';

import type { TaskFieldHistoryEntry, TaskStatusHistoryEntry } from '../tasks.type';
import { mergeTaskHistory } from './tasks-api.util';

const MANAGER_ACTOR = { full_name: 'Иван Петров' };

// Тестовый хелпер: запись истории статусов.
function statusEntry(id: number, changedAt: string): TaskStatusHistoryEntry {
  return {
    kind: 'status',
    id,
    from_status: null,
    to_status: 'new',
    changed_at: changedAt,
    comment: null,
    actor: MANAGER_ACTOR,
  };
}

// Тестовый хелпер: запись истории полей.
function fieldEntry(id: number, changedAt: string): TaskFieldHistoryEntry {
  return {
    kind: 'field',
    id,
    field: 'title',
    old_value: 'Старое',
    new_value: 'Новое',
    changed_at: changedAt,
    actor: MANAGER_ACTOR,
  };
}

// Тестовый хелпер: компактное представление результата для сравнения порядка.
function keys(entries: ReadonlyArray<{ kind: string; id: number }>): string[] {
  return entries.map((entry) => `${entry.kind}-${entry.id}`);
}

describe('step 8 §4.1 mergeTaskHistory: ascending by Date.parse(changed_at)', () => {
  it('both empty → []', () => {
    expect(mergeTaskHistory([], [])).toEqual([]);
  });

  it('only status entries → returned as given (already ascending)', () => {
    const status = [statusEntry(1, '2026-03-15T09:00:00Z'), statusEntry(2, '2026-03-16T09:00:00Z')];

    expect(keys(mergeTaskHistory(status, []))).toEqual(['status-1', 'status-2']);
  });

  it('interleaves status and field entries by time ascending', () => {
    const status = [statusEntry(1, '2026-03-15T09:00:00Z'), statusEntry(2, '2026-03-17T09:00:00Z')];
    const field = [fieldEntry(1, '2026-03-16T09:00:00Z'), fieldEntry(2, '2026-03-18T09:00:00Z')];

    expect(keys(mergeTaskHistory(status, field))).toEqual([
      'status-1',
      'field-1',
      'status-2',
      'field-2',
    ]);
  });

  it('compares parsed instants, not strings: «12:00+03:00» (09:00Z) comes before «09:30Z»', () => {
    const status = [statusEntry(1, '2026-03-15T09:30:00Z')];
    const field = [fieldEntry(1, '2026-03-15T12:00:00+03:00')];

    expect(keys(mergeTaskHistory(status, field))).toEqual(['field-1', 'status-1']);
  });

  it('field entry earlier than every status entry goes first', () => {
    const status = [statusEntry(1, '2026-03-15T09:00:00Z')];
    const field = [fieldEntry(5, '2026-03-14T09:00:00Z')];

    expect(keys(mergeTaskHistory(status, field))).toEqual(['field-5', 'status-1']);
  });
});

describe('step 8 §4.1 mergeTaskHistory tie-break: «status» before «field», then ascending id', () => {
  it('same changed_at: status entry precedes field entry even with a larger id', () => {
    const at = '2026-03-15T09:00:00Z';

    expect(keys(mergeTaskHistory([statusEntry(10, at)], [fieldEntry(1, at)]))).toEqual([
      'status-10',
      'field-1',
    ]);
  });

  it('same changed_at and same kind: ascending id', () => {
    const at = '2026-03-15T09:00:00Z';
    const status = [statusEntry(4, at), statusEntry(3, at)];
    const field = [fieldEntry(7, at), fieldEntry(5, at), fieldEntry(6, at)];

    expect(keys(mergeTaskHistory(status, field))).toEqual([
      'status-3',
      'status-4',
      'field-5',
      'field-6',
      'field-7',
    ]);
  });

  it('same instant written in different offsets counts as a tie', () => {
    const status = [statusEntry(2, '2026-03-15T12:00:00+03:00')];
    const field = [fieldEntry(1, '2026-03-15T09:00:00Z')];

    expect(keys(mergeTaskHistory(status, field))).toEqual(['status-2', 'field-1']);
  });
});

describe('step 8 §4.1 mergeTaskHistory «returns new array, does not mutate inputs»', () => {
  it('inputs keep their order and content; result is a different array', () => {
    const status = [statusEntry(2, '2026-03-17T09:00:00Z'), statusEntry(1, '2026-03-15T09:00:00Z')];
    const field = [fieldEntry(1, '2026-03-16T09:00:00Z')];
    const statusCopy = structuredClone(status);
    const fieldCopy = structuredClone(field);
    const result = mergeTaskHistory(status, field);

    expect(keys(result)).toEqual(['status-1', 'field-1', 'status-2']);
    expect(result).not.toBe(status);
    expect(result).not.toBe(field);
    expect(status).toEqual(statusCopy);
    expect(field).toEqual(fieldCopy);
  });

  it('accepts frozen inputs without throwing', () => {
    const status = Object.freeze([
      statusEntry(2, '2026-03-17T09:00:00Z'),
      statusEntry(1, '2026-03-15T09:00:00Z'),
    ]);
    const field = Object.freeze([fieldEntry(1, '2026-03-16T09:00:00Z')]);

    expect(keys(mergeTaskHistory(status, field))).toEqual(['status-1', 'field-1', 'status-2']);
  });

  it('entries are passed through unchanged (same field values)', () => {
    const field = fieldEntry(1, '2026-03-16T09:00:00Z');
    const [only] = mergeTaskHistory([], [field]);

    expect(only).toEqual(field);
  });
});
