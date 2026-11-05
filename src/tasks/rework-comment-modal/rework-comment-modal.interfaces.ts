export interface ReworkCommentModalProps {
  opened: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}
