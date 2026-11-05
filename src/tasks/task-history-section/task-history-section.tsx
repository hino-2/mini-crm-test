import { Loader, Spoiler, Table, Text, Title } from '@mantine/core';
import { SYSTEM_ACTOR_LABEL } from '../../profiles/profiles.constants';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import {
  TASK_CREATED_HISTORY_LABEL,
  TASK_FIELD_LABELS,
  TASK_HISTORY_DELETED_LABEL,
  TASK_HISTORY_EMPTY_VALUE,
  TASK_HISTORY_RESTORED_LABEL,
  TASK_STATUS_LABELS,
} from '../tasks.constants';
import type { TaskHistoryEntry } from '../tasks.type';
import { useTaskHistory } from '../tasks-queries/tasks-queries';
import type { TaskHistorySectionProps } from './task-history-section.interfaces';

function renderChange(entry: TaskHistoryEntry): JSX.Element | string {
  if (entry.kind === 'status') {
    return entry.from_status === null
      ? TASK_CREATED_HISTORY_LABEL
      : `${TASK_STATUS_LABELS[entry.from_status]} → ${TASK_STATUS_LABELS[entry.to_status]}`;
  }

  switch (entry.field) {
    case 'title':
      return `Изменено поле «${TASK_FIELD_LABELS.title}»: «${entry.old_value ?? ''}» → «${entry.new_value ?? ''}»`;
    case 'assignee_id':
      return `Изменено поле «${TASK_FIELD_LABELS.assignee_id}»: ${entry.old_value ?? ''} → ${entry.new_value ?? ''}`;
    case 'description':
      return (
        <>
          <Text>{`Изменено поле «${TASK_FIELD_LABELS.description}»`}</Text>
          <Spoiler maxHeight={60} showLabel="Показать полностью" hideLabel="Скрыть">
            <Text style={{ whiteSpace: 'pre-wrap' }}>
              {`Было: ${entry.old_value || TASK_HISTORY_EMPTY_VALUE}`}
            </Text>
            <Text style={{ whiteSpace: 'pre-wrap' }}>
              {`Стало: ${entry.new_value || TASK_HISTORY_EMPTY_VALUE}`}
            </Text>
          </Spoiler>
        </>
      );
    case 'deleted_at':
      return entry.old_value === null ? TASK_HISTORY_DELETED_LABEL : TASK_HISTORY_RESTORED_LABEL;
  }
}

export function TaskHistorySection({ taskId }: TaskHistorySectionProps): JSX.Element {
  const { data, isPending, error } = useTaskHistory(taskId);

  useNotifyError(error);

  return (
    <>
      <Title order={3} mt="lg">
        История
      </Title>
      {isPending && !error && <Loader />}
      {data !== undefined && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Дата</Table.Th>
              <Table.Th>Кто</Table.Th>
              <Table.Th>Изменение</Table.Th>
              <Table.Th>Комментарий</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((entry) => (
              <Table.Tr key={`${entry.kind}-${entry.id}`}>
                <Table.Td>{new Date(entry.changed_at).toLocaleString('ru-RU')}</Table.Td>
                <Table.Td>{entry.actor?.full_name ?? SYSTEM_ACTOR_LABEL}</Table.Td>
                <Table.Td>{renderChange(entry)}</Table.Td>
                <Table.Td>{entry.kind === 'status' ? (entry.comment ?? '') : ''}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
