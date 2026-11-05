import { Anchor, Badge, Button, Group, Loader, Table, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { generatePath, Link, useNavigate, useParams } from 'react-router';
import { ROUTE_PATHS } from '../../app/app.constants';
import { useCurrentProfile } from '../../auth/auth-context/auth-context';
import { NOT_FOUND_OR_NO_ACCESS_TEXT } from '../../shared/errors/errors.constants';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import { TaskEditModal } from '../task-edit-modal/task-edit-modal';
import { TaskHistorySection } from '../task-history-section/task-history-section';
import { TaskStatusActions } from '../task-status-actions/task-status-actions';
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '../tasks.constants';
import { useDeleteTask, useTask } from '../tasks-queries/tasks-queries';

export function TaskCardPage(): JSX.Element {
  const { taskId = '' } = useParams();
  const { role } = useCurrentProfile();
  const isManager = role === 'manager';
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const { data: task, isPending, error } = useTask(taskId);
  const del = useDeleteTask(taskId);

  useNotifyError(error);

  const confirmDelete = (objectId: string): string =>
    modals.openConfirmModal({
      title: 'Удалить задачу?',
      children: <Text>Задача будет перемещена в корзину. Восстановить её можно из корзины.</Text>,
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        del.mutate(undefined, {
          onSuccess: () => navigate(generatePath(ROUTE_PATHS.object, { objectId })),
        }),
    });

  return (
    <>
      <Title order={2}>Карточка задачи</Title>
      {isPending && !error && <Loader />}
      {task === null && <Text>{NOT_FOUND_OR_NO_ACCESS_TEXT}</Text>}
      {task && (
        <>
          <Title order={3}>{task.title}</Title>
          {isManager && (
            <Group my="md">
              <Button onClick={open}>Редактировать</Button>
              <Button
                color="red"
                loading={del.isPending}
                onClick={() => confirmDelete(task.object_id)}
              >
                Удалить
              </Button>
            </Group>
          )}
          <Table variant="vertical" withTableBorder>
            <Table.Tbody>
              <Table.Tr>
                <Table.Th>Описание</Table.Th>
                <Table.Td style={{ whiteSpace: 'pre-wrap' }}>
                  {task.description.trim() === '' ? '—' : task.description}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Объект</Table.Th>
                <Table.Td>
                  <Anchor
                    component={Link}
                    to={generatePath(ROUTE_PATHS.object, { objectId: task.object_id })}
                  >
                    {task.object.name}
                  </Anchor>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Исполнитель</Table.Th>
                <Table.Td>{task.assignee.full_name}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Статус</Table.Th>
                <Table.Td>
                  <Badge color={TASK_STATUS_COLORS[task.status]}>
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Автор</Table.Th>
                <Table.Td>{task.author.full_name}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Дата создания</Table.Th>
                <Table.Td>{new Date(task.created_at).toLocaleString('ru-RU')}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <TaskStatusActions task={task} />
          <TaskHistorySection taskId={task.id} />
          {isManager && <TaskEditModal task={task} opened={opened} onClose={close} />}
        </>
      )}
    </>
  );
}
