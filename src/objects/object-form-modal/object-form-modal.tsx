import { Button, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { validateText } from '../../shared/forms/forms.util';
import {
  OBJECT_ADDRESS_MAX_LENGTH,
  OBJECT_ADDRESS_REQUIRED_MESSAGE,
  OBJECT_NAME_MAX_LENGTH,
  OBJECT_NAME_REQUIRED_MESSAGE,
} from '../objects.constants';
import type { ObjectInput } from '../objects.type';
import type { ObjectFormModalProps } from './object-form-modal.interfaces';
import type { ObjectFormProps } from './object-form-modal.type';

function ObjectForm({
  initialValues,
  submitLabel,
  loading,
  onSubmit,
}: ObjectFormProps): JSX.Element {
  const form = useForm<ObjectInput, (values: ObjectInput) => ObjectInput>({
    initialValues,
    validate: {
      name: (value) => validateText(value, OBJECT_NAME_MAX_LENGTH, OBJECT_NAME_REQUIRED_MESSAGE),
      address: (value) =>
        validateText(value, OBJECT_ADDRESS_MAX_LENGTH, OBJECT_ADDRESS_REQUIRED_MESSAGE),
    },
    transformValues: (values) => ({ name: values.name.trim(), address: values.address.trim() }),
  });

  return (
    <form noValidate onSubmit={form.onSubmit(onSubmit)}>
      <Stack>
        <TextInput label="Название" {...form.getInputProps('name')} />
        <TextInput label="Адрес" {...form.getInputProps('address')} />
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}

export function ObjectFormModal({
  opened,
  title,
  submitLabel,
  initialValues,
  loading,
  onClose,
  onSubmit,
}: ObjectFormModalProps): JSX.Element {
  return (
    <Modal opened={opened} title={title} onClose={onClose}>
      <ObjectForm
        initialValues={initialValues}
        submitLabel={submitLabel}
        loading={loading}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
