import { Button, Loader, Table, Text, Title } from '@mantine/core';
import { SYSTEM_ACTOR_LABEL } from '../../profiles/profiles.constants';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import {
  useDeletedObjects,
  useDeletedTasks,
  useRestoreObject,
  useRestoreTask,
} from '../trash-queries/trash-queries';

export function TrashPage(): JSX.Element {
  const objects = useDeletedObjects();
  const tasks = useDeletedTasks();
  const restoreObject = useRestoreObject();
  const restoreTask = useRestoreTask();

  useNotifyError(objects.error);
  useNotifyError(tasks.error);

  return (
    <>
      <Title order={2}>Корзина</Title>
      <Title order={3} mt="lg">
        Удалённые объекты
      </Title>
      {objects.isPending && !objects.error && <Loader />}
      {objects.data?.length === 0 && <Text>Нет удалённых объектов</Text>}
      {objects.data !== undefined && objects.data.length > 0 && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Адрес</Table.Th>
              <Table.Th>Удалён</Table.Th>
              <Table.Th>Кто удалил</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {objects.data.map((object) => (
              <Table.Tr key={object.id}>
                <Table.Td>{object.name}</Table.Td>
                <Table.Td>{object.address}</Table.Td>
                <Table.Td>{new Date(object.deleted_at).toLocaleString('ru-RU')}</Table.Td>
                <Table.Td>{object.deleted_by_name ?? SYSTEM_ACTOR_LABEL}</Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    disabled={restoreObject.isPending}
                    onClick={() => restoreObject.mutate(object.id)}
                  >
                    Восстановить
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Title order={3} mt="lg">
        Удалённые задачи
      </Title>
      {tasks.isPending && !tasks.error && <Loader />}
      {tasks.data?.length === 0 && <Text>Нет удалённых задач</Text>}
      {tasks.data !== undefined && tasks.data.length > 0 && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Объект</Table.Th>
              <Table.Th>Удалена</Table.Th>
              <Table.Th>Кто удалил</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tasks.data.map((task) => (
              <Table.Tr key={task.id}>
                <Table.Td>{task.title}</Table.Td>
                <Table.Td>
                  {task.object_name}
                  {task.object_deleted && (
                    <Text span c="dimmed" ml="xs">
                      объект в корзине
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{new Date(task.deleted_at).toLocaleString('ru-RU')}</Table.Td>
                <Table.Td>{task.deleted_by_name ?? SYSTEM_ACTOR_LABEL}</Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    disabled={task.object_deleted || restoreTask.isPending}
                    onClick={() => restoreTask.mutate(task.id)}
                  >
                    Восстановить
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
