import { Badge, Button, Loader, Table, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { generatePath, useNavigate } from 'react-router';
import { ROUTE_PATHS } from '../../app/app.constants';
import { useCurrentProfile } from '../../auth/auth-context/auth-context';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import { TaskCreateModal } from '../task-create-modal/task-create-modal';
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '../tasks.constants';
import { useObjectTasks } from '../tasks-queries/tasks-queries';
import type { ObjectTasksSectionProps } from './object-tasks-section.interfaces';

export function ObjectTasksSection({ objectId }: ObjectTasksSectionProps): JSX.Element {
  const { role } = useCurrentProfile();
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const { data, isPending, error } = useObjectTasks(objectId);

  useNotifyError(error);

  return (
    <>
      <Title order={3} mt="lg">
        Задачи
      </Title>
      {role === 'manager' && (
        <Button my="md" onClick={open}>
          Создать задачу
        </Button>
      )}
      {isPending && !error && <Loader />}
      {data?.length === 0 && <Text>Задач пока нет</Text>}
      {data !== undefined && data.length > 0 && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Исполнитель</Table.Th>
              <Table.Th>Статус</Table.Th>
              <Table.Th>Создана</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((task) => (
              <Table.Tr
                key={task.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(generatePath(ROUTE_PATHS.task, { taskId: task.id }))}
              >
                <Table.Td>{task.title}</Table.Td>
                <Table.Td>{task.assignee.full_name}</Table.Td>
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
      <TaskCreateModal objectId={objectId} opened={opened} onClose={close} />
    </>
  );
}
