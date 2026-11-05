import { Button, Modal, Stack, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { ERROR_MESSAGES } from '../../shared/errors/errors.constants';
import { validateText } from '../../shared/forms/forms.util';
import { TASK_COMMENT_MAX_LENGTH } from '../tasks.constants';
import type { ReworkCommentModalProps } from './rework-comment-modal.interfaces';
import type { ReworkCommentFormProps, ReworkCommentFormValues } from './rework-comment-modal.type';

function ReworkCommentForm({ loading, onSubmit }: ReworkCommentFormProps): JSX.Element {
  const form = useForm<ReworkCommentFormValues, (values: ReworkCommentFormValues) => string>({
    initialValues: { comment: '' },
    validate: {
      comment: (value) =>
        validateText(value, TASK_COMMENT_MAX_LENGTH, ERROR_MESSAGES.COMMENT_REQUIRED),
    },
    transformValues: (values) => values.comment.trim(),
  });

  return (
    <form noValidate onSubmit={form.onSubmit((comment) => onSubmit(comment))}>
      <Stack>
        <Textarea label="Комментарий" {...form.getInputProps('comment')} />
        <Button type="submit" loading={loading}>
          Отправить
        </Button>
      </Stack>
    </form>
  );
}

export function ReworkCommentModal({
  opened,
  loading,
  onClose,
  onSubmit,
}: ReworkCommentModalProps): JSX.Element {
  return (
    <Modal opened={opened} title="Вернуть на доработку" onClose={onClose}>
      <ReworkCommentForm loading={loading} onSubmit={onSubmit} />
    </Modal>
  );
}
