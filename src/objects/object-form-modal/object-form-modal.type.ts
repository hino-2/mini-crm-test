import type { ObjectFormModalProps } from './object-form-modal.interfaces';

export type ObjectFormProps = Pick<
  ObjectFormModalProps,
  'initialValues' | 'submitLabel' | 'loading' | 'onSubmit'
>;
