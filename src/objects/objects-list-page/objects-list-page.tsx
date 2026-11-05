import { Anchor, Button, Loader, Table, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { generatePath, Link } from 'react-router';
import { ROUTE_PATHS } from '../../app/app.constants';
import { useCurrentProfile } from '../../auth/auth-context/auth-context';
import { useNotifyError } from '../../shared/errors/errors.hooks';
import { ObjectFormModal } from '../object-form-modal/object-form-modal';
import { useCreateObject, useObjects } from '../objects-queries/objects-queries';

export function ObjectsListPage(): JSX.Element {
  const { role } = useCurrentProfile();
  const isManager = role === 'manager';
  const [opened, { open, close }] = useDisclosure(false);
  const { data, isPending, error } = useObjects();
  const create = useCreateObject();

  useNotifyError(error);

  return (
    <>
      <Title order={2}>Объекты</Title>
      {isManager && (
        <Button my="md" onClick={open}>
          Создать объект
        </Button>
      )}
      {isPending && !error && <Loader />}
      {data?.length === 0 && (
        <Text>{isManager ? 'Объектов пока нет' : 'У вас пока нет объектов'}</Text>
      )}
      {data !== undefined && data.length > 0 && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Адрес</Table.Th>
              <Table.Th>Задач</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((object) => (
              <Table.Tr key={object.id}>
                <Table.Td>
                  <Anchor
                    component={Link}
                    to={generatePath(ROUTE_PATHS.object, { objectId: object.id })}
                  >
                    {object.name}
                  </Anchor>
                </Table.Td>
                <Table.Td>{object.address}</Table.Td>
                <Table.Td>{object.task_count}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <ObjectFormModal
        opened={opened}
        title="Создать объект"
        submitLabel="Создать"
        initialValues={{ name: '', address: '' }}
        loading={create.isPending}
        onClose={close}
        onSubmit={(values) => create.mutate(values, { onSuccess: close })}
      />
    </>
  );
}
