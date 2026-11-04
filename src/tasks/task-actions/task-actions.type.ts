import type { TaskStatus } from '../tasks.type';

export type TaskActionId = 'start' | 'submit_for_review' | 'accept' | 'return_to_rework' | 'resume';

export type TaskAction = {
  id: TaskActionId;
  label: string;
  toStatus: TaskStatus;
  requiresComment: boolean;
};

export type TaskActor = 'assignee' | 'manager';

export type TaskActionDefinition = TaskAction & { fromStatus: TaskStatus; actor: TaskActor };
