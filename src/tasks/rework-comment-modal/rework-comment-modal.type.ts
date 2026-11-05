import type { ReworkCommentModalProps } from './rework-comment-modal.interfaces';

export type ReworkCommentFormProps = Pick<ReworkCommentModalProps, 'loading' | 'onSubmit'>;

export type ReworkCommentFormValues = { comment: string };
