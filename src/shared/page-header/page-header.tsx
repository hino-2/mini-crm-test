import { Box, Button, Title } from '@mantine/core';
import { Link } from 'react-router';
import type { PageHeaderProps } from './page-header.interfaces';

// On wide screens «Назад» sits in the left gutter so the title stays aligned with the content;
// on narrow screens there is no gutter, so it falls back above the title.
export function PageHeader({ title, backTo }: PageHeaderProps): JSX.Element {
  return (
    <Box pos="relative">
      {backTo !== undefined && (
        <Button
          component={Link}
          to={backTo}
          variant="subtle"
          px="xs"
          pos={{ base: 'static', lg: 'absolute' }}
          top={0}
          right="100%"
          mr={{ base: 0, lg: 'lg' }}
        >
          <span aria-hidden="true">←&nbsp;</span>Назад
        </Button>
      )}
      <Title order={2}>{title}</Title>
    </Box>
  );
}
