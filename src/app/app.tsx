import { Container, Title } from '@mantine/core';
import { Route, Routes } from 'react-router';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Container>
            <Title order={1}>Мини-CRM «Объекты и задачи»</Title>
          </Container>
        }
      />
    </Routes>
  );
}
