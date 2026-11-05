import type { TaskDetails } from '../tasks.type';

export interface TaskEditModalProps {
  task: TaskDetails;
  opened: boolean;
  onClose: () => void;
}
