import { Anchor, Container, Stack, Title } from '@mantine/core';
import { Link } from 'react-router';

export function NotFoundPage(): JSX.Element {
  return (
    <Container my={80}>
      <Stack align="flex-start">
        <Title order={2}>Страница не найдена</Title>
        <Anchor component={Link} to="/">
          На главную
        </Anchor>
      </Stack>
    </Container>
  );
}
