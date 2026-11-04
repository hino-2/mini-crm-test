import type { ObjectInput } from '../objects.type';

export interface ObjectFormModalProps {
  opened: boolean;
  title: string;
  submitLabel: string;
  initialValues: ObjectInput;
  loading: boolean;
  onClose(): void;
  onSubmit(values: ObjectInput): void;
}
