import { Button, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useExecutors } from '../../profiles/profiles-queries/profiles-queries';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import { validateText } from '../../shared/forms/forms.util';
import {
  TASK_ASSIGNEE_REQUIRED_MESSAGE,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  TASK_TITLE_REQUIRED_MESSAGE,
} from '../tasks.constants';
import type { TaskCreateInput, TaskFormValues } from '../tasks.type';
import { useCreateTask } from '../tasks-queries/tasks-queries';
import type { TaskCreateModalProps } from './task-create-modal.interfaces';
import type { TaskCreateFormProps } from './task-create-modal.type';

function TaskCreateForm({ objectId, onClose }: TaskCreateFormProps): JSX.Element {
  const executors = useExecutors();
  const create = useCreateTask(objectId);
  const form = useForm<TaskFormValues, (values: TaskFormValues) => TaskCreateInput>({
    initialValues: { title: '', description: '', assignee_id: null },
    validate: {
      title: (value) => validateText(value, TASK_TITLE_MAX_LENGTH, TASK_TITLE_REQUIRED_MESSAGE),
      description: (value) => validateText(value, TASK_DESCRIPTION_MAX_LENGTH, null),
      assignee_id: (value) => (value ? null : TASK_ASSIGNEE_REQUIRED_MESSAGE),
    },
    transformValues: (values) => ({
      object_id: objectId,
      title: values.title.trim(),
      description: values.description.trim(),
      assignee_id: values.assignee_id ?? '',
    }),
  });

  useNotifyError(executors.error);

  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) => create.mutate(values, { onSuccess: onClose }))}
    >
      <Stack>
        <TextInput label="Название" {...form.getInputProps('title')} />
        <Textarea label="Описание" {...form.getInputProps('description')} />
        <Select
          label="Исполнитель"
          comboboxProps={{ hideDetached: false }}
          disabled={executors.isPending}
          data={(executors.data ?? []).map((executor) => ({
            value: executor.id,
            label: executor.full_name,
          }))}
          {...form.getInputProps('assignee_id')}
        />
        <Button type="submit" loading={create.isPending}>
          Создать
        </Button>
      </Stack>
    </form>
  );
}

export function TaskCreateModal({ objectId, opened, onClose }: TaskCreateModalProps): JSX.Element {
  return (
    <Modal opened={opened} title="Создать задачу" onClose={onClose}>
      <TaskCreateForm objectId={objectId} onClose={onClose} />
    </Modal>
  );
}
