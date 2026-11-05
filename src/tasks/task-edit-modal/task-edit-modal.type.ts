import type { TaskEditModalProps } from './task-edit-modal.interfaces';

export type TaskEditFormProps = Pick<TaskEditModalProps, 'task' | 'onClose'>;
