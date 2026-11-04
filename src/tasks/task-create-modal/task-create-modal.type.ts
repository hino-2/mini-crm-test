import type { TaskCreateModalProps } from './task-create-modal.interfaces';

export type TaskCreateFormProps = Pick<TaskCreateModalProps, 'objectId' | 'onClose'>;
