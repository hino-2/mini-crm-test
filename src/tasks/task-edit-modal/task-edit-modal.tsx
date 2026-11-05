import { Button, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useObjects } from '../../objects/objects-queries/objects-queries';
import { useExecutors } from '../../profiles/profiles-queries/profiles-queries';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import { validateText } from '../../shared/forms/forms.util';
import {
  TASK_ASSIGNEE_REQUIRED_MESSAGE,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_OBJECT_REQUIRED_MESSAGE,
  TASK_TITLE_MAX_LENGTH,
  TASK_TITLE_REQUIRED_MESSAGE,
} from '../tasks.constants';
import type { TaskEditFormValues, TaskUpdateInput } from '../tasks.type';
import { useUpdateTask } from '../tasks-queries/tasks-queries';
import type { TaskEditModalProps } from './task-edit-modal.interfaces';
import type { TaskEditFormProps } from './task-edit-modal.type';

function TaskEditForm({ task, onClose }: TaskEditFormProps): JSX.Element {
  const executors = useExecutors();
  const objects = useObjects();
  const update = useUpdateTask(task.id);
  const form = useForm<TaskEditFormValues, (values: TaskEditFormValues) => TaskUpdateInput>({
    initialValues: {
      title: task.title,
      description: task.description,
      assignee_id: task.assignee_id,
      object_id: task.object_id,
    },
    validate: {
      title: (value) => validateText(value, TASK_TITLE_MAX_LENGTH, TASK_TITLE_REQUIRED_MESSAGE),
      description: (value) => validateText(value, TASK_DESCRIPTION_MAX_LENGTH, null),
      assignee_id: (value) => (value ? null : TASK_ASSIGNEE_REQUIRED_MESSAGE),
      object_id: (value) => (value ? null : TASK_OBJECT_REQUIRED_MESSAGE),
    },
    transformValues: (values) => ({
      object_id: values.object_id ?? '',
      title: values.title.trim(),
      description: values.description.trim(),
      assignee_id: values.assignee_id ?? '',
    }),
  });

  useNotifyError(executors.error);
  useNotifyError(objects.error);

  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) => update.mutate(values, { onSuccess: onClose }))}
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
        <Select
          label="Объект"
          comboboxProps={{ hideDetached: false }}
          disabled={objects.isPending}
          data={(objects.data ?? []).map((object) => ({ value: object.id, label: object.name }))}
          {...form.getInputProps('object_id')}
        />
        <Button type="submit" loading={update.isPending}>
          Сохранить
        </Button>
      </Stack>
    </form>
  );
}

export function TaskEditModal({ task, opened, onClose }: TaskEditModalProps): JSX.Element {
  return (
    <Modal opened={opened} title="Редактировать задачу" onClose={onClose}>
      <TaskEditForm task={task} onClose={onClose} />
    </Modal>
  );
}
