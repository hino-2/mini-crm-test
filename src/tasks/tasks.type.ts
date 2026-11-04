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
