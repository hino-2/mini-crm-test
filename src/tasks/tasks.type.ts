export type TaskStatus = 'new' | 'in_progress' | 'on_review' | 'accepted' | 'rework';

export type Task = {
  id: string;
  object_id: string;
  title: string;
  description: string;
  assignee_id: string;
  status: TaskStatus;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type TaskListItem = Pick<Task, 'id' | 'title' | 'status' | 'created_at'> & {
  assignee: { full_name: string };
};

export type TaskCreateInput = Pick<Task, 'object_id' | 'title' | 'description' | 'assignee_id'>;

export type TaskFormValues = { title: string; description: string; assignee_id: string | null };

export type TaskDetails = Pick<
  Task,
  'id' | 'object_id' | 'title' | 'description' | 'assignee_id' | 'status' | 'created_at'
> & {
  object: { name: string };
  assignee: { full_name: string };
  author: { full_name: string };
};

export type TaskHistoryEntry = {
  id: number;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  changed_at: string;
  comment: string | null;
  actor: { full_name: string };
};

export type MyTaskItem = Pick<Task, 'id' | 'title' | 'status' | 'created_at'> & {
  object: { name: string };
};

export type TaskUpdateInput = TaskCreateInput;

export type TaskEditFormValues = TaskFormValues & { object_id: string | null };

export type ChangeTaskStatusVariables = { toStatus: TaskStatus; comment: string | null };
