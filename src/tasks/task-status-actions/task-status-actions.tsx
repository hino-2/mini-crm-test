import { Alert, Button, Group, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useCurrentProfile } from '../../auth/auth-context/auth-context';
import { ReworkCommentModal } from '../rework-comment-modal/rework-comment-modal';
import { getAvailableActions } from '../task-actions/task-actions';
import { useChangeTaskStatus, useTaskHistory } from '../tasks-queries/tasks-queries';
import type { TaskStatusActionsProps } from './task-status-actions.interfaces';

export function TaskStatusActions({ task }: TaskStatusActionsProps): JSX.Element | null {
  const profile = useCurrentProfile();
  const [opened, { open, close }] = useDisclosure(false);
  const history = useTaskHistory(task.id);
  const changeStatus = useChangeTaskStatus(task.id);
  const actions = getAvailableActions(task, profile);
  const reworkComment =
    profile.role === 'executor' && task.status === 'rework'
      ? ((history.data ?? []).filter((entry) => entry.to_status === 'rework').at(-1)?.comment ??
        null)
      : null;

  // The modal state outlives the action (this component stays mounted): drop it as soon as the
  // rework action disappears, otherwise the modal pops up again when the action comes back.
  if (opened && !actions.some((action) => action.requiresComment)) {
    close();
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <Stack my="md">
      {reworkComment !== null && (
        <Alert color="red" title="Комментарий к доработке">
          {reworkComment}
        </Alert>
      )}
      <Group>
        {actions.map((action) => (
          <Button
            key={action.id}
            disabled={changeStatus.isPending}
            onClick={() =>
              action.requiresComment
                ? open()
                : changeStatus.mutate({ toStatus: action.toStatus, comment: null })
            }
          >
            {action.label}
          </Button>
        ))}
      </Group>
      <ReworkCommentModal
        opened={opened}
        loading={changeStatus.isPending}
        onClose={close}
        onSubmit={(comment) =>
          changeStatus.mutate({ toStatus: 'rework', comment }, { onSuccess: close })
        }
      />
    </Stack>
  );
}
