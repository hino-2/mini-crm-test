import { Loader, Table, Title } from '@mantine/core';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import { TASK_CREATED_HISTORY_LABEL, TASK_STATUS_LABELS } from '../tasks.constants';
import { useTaskHistory } from '../tasks-queries/tasks-queries';
import type { TaskHistorySectionProps } from './task-history-section.interfaces';

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
              <Table.Tr key={entry.id}>
                <Table.Td>{new Date(entry.changed_at).toLocaleString('ru-RU')}</Table.Td>
                <Table.Td>{entry.actor.full_name}</Table.Td>
                <Table.Td>
                  {entry.from_status === null
                    ? TASK_CREATED_HISTORY_LABEL
                    : `${TASK_STATUS_LABELS[entry.from_status]} → ${TASK_STATUS_LABELS[entry.to_status]}`}
                </Table.Td>
                <Table.Td>{entry.comment ?? ''}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
