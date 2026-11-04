import { Alert, Button, Container, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { getLoginErrorMessage } from '../../shared/errors/errors.util';
import { useAuth } from '../auth-context/auth-context';
import type { LoginFormValues } from './login-page.type';

export function LoginPage(): JSX.Element {
  const { signIn } = useAuth();
  const form = useForm<LoginFormValues>({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (value.trim() === '' ? 'Введите email' : null),
      password: (value) => (value === '' ? 'Введите пароль' : null),
    },
  });
  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => signIn(values.email.trim(), values.password),
  });

  return (
    <Container size={420} my={80}>
      <Title order={1} mb="lg">
        Вход
      </Title>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))} noValidate>
        <Stack>
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Пароль"
            autoComplete="current-password"
            {...form.getInputProps('password')}
          />
          {mutation.error && <Alert color="red">{getLoginErrorMessage(mutation.error)}</Alert>}
          <Button type="submit" loading={mutation.isPending}>
            Войти
          </Button>
        </Stack>
      </form>
    </Container>
  );
}
