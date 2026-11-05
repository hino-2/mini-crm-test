import { Anchor, Badge, Loader, SegmentedControl, Table, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { generatePath, Link } from 'react-router';
import { ROUTE_PATHS } from '../../app/app.constants';
import { useCurrentProfile } from '../../auth/auth-context/auth-context';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '../tasks.constants';
import { useMyTasks } from '../tasks-queries/tasks-queries';
import { MY_TASKS_FILTER_ALL, MY_TASKS_FILTER_OPTIONS } from './my-tasks-page.constants';
import { sortMyTasks } from './my-tasks-page.util';

export function MyTasksPage(): JSX.Element {
  const { id } = useCurrentProfile();
  const [filter, setFilter] = useState<string>(MY_TASKS_FILTER_ALL);
  const { data, isPending, error } = useMyTasks(id);
  const rows = sortMyTasks(data ?? []).filter(
    (task) => filter === MY_TASKS_FILTER_ALL || task.status === filter,
  );

  useNotifyError(error);

  return (
    <>
      <Title order={2}>Мои задачи</Title>
      <SegmentedControl
        my="md"
        aria-label="Фильтр по статусу"
        data={MY_TASKS_FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
      />
      {isPending && !error && <Loader />}
      {data?.length === 0 && <Text>У вас пока нет задач</Text>}
      {data !== undefined && data.length > 0 && rows.length === 0 && (
        <Text>Нет задач с таким статусом</Text>
      )}
      {rows.length > 0 && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Объект</Table.Th>
              <Table.Th>Статус</Table.Th>
              <Table.Th>Создана</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((task) => (
              <Table.Tr key={task.id}>
                <Table.Td>
                  <Anchor component={Link} to={generatePath(ROUTE_PATHS.task, { taskId: task.id })}>
                    {task.title}
                  </Anchor>
                </Table.Td>
                <Table.Td>{task.object.name}</Table.Td>
                <Table.Td>
                  <Badge color={TASK_STATUS_COLORS[task.status]}>
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </Table.Td>
                <Table.Td>{new Date(task.created_at).toLocaleString('ru-RU')}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
