import { Button, Group, Loader, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useNavigate, useParams } from 'react-router';
import { ROUTE_PATHS } from '../../app/app.constants';
import { useCurrentProfile } from '../../auth/auth-context/auth-context';
import { NOT_FOUND_OR_NO_ACCESS_TEXT } from '../../shared/errors/errors.constants';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import { ObjectTasksSection } from '../../tasks/object-tasks-section/object-tasks-section';
import { ObjectFormModal } from '../object-form-modal/object-form-modal';
import { useDeleteObject, useObject, useUpdateObject } from '../objects-queries/objects-queries';

export function ObjectCardPage(): JSX.Element {
  const { objectId = '' } = useParams();
  const { role } = useCurrentProfile();
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const { data: object, isPending, error } = useObject(objectId);
  const update = useUpdateObject(objectId);
  const del = useDeleteObject(objectId);

  useNotifyError(error);

  const confirmDelete = (taskCount: number): string =>
    modals.openConfirmModal({
      title: 'Удалить объект?',
      children: <Text>{`Будет удалено задач: ${taskCount}. Действие необратимо`}</Text>,
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate(undefined, { onSuccess: () => navigate(ROUTE_PATHS.objects) }),
    });

  return (
    <>
      <Title order={2}>Карточка объекта</Title>
      {isPending && !error && <Loader />}
      {object === null && <Text>{NOT_FOUND_OR_NO_ACCESS_TEXT}</Text>}
      {object && (
        <>
          <Title order={3}>{object.name}</Title>
          <Text>{object.address}</Text>
          {role === 'manager' && (
            <Group my="md">
              <Button onClick={open}>Редактировать</Button>
              <Button
                color="red"
                loading={del.isPending}
                onClick={() => confirmDelete(object.task_count)}
              >
                Удалить
              </Button>
            </Group>
          )}
          <ObjectTasksSection objectId={object.id} />
          <ObjectFormModal
            opened={opened}
            title="Редактировать объект"
            submitLabel="Сохранить"
            initialValues={{ name: object.name, address: object.address }}
            loading={update.isPending}
            onClose={close}
            onSubmit={(values) => update.mutate(values, { onSuccess: close })}
          />
        </>
      )}
    </>
  );
}
