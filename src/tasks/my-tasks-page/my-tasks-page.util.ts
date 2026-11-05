import type { MyTaskItem } from '../tasks.type';
import { MY_TASKS_STATUS_ORDER } from './my-tasks-page.constants';

export function sortMyTasks(tasks: readonly MyTaskItem[]): MyTaskItem[] {
  return [...tasks].sort(
    (a, b) =>
      MY_TASKS_STATUS_ORDER.indexOf(a.status) - MY_TASKS_STATUS_ORDER.indexOf(b.status) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
