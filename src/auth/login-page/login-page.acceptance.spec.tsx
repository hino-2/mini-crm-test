import { AuthApiError } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import { AuthContext } from '../auth-context/auth-context';
import type { AuthContextValue } from '../auth.interfaces';
import { LoginPage } from './login-page';

// Тестовый хелпер: фейк гостевого контекста авторизации.
function guestAuth(signIn: AuthContextValue['signIn']): AuthContextValue {
  return {
    status: 'unauthenticated',
    session: null,
    profile: null,
    signIn,
    signOut: vi.fn<AuthContextValue['signOut']>().mockResolvedValue(undefined),
  };
}

function renderLogin(signIn: AuthContextValue['signIn']): void {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/login']}>
        <AuthContext.Provider value={guestAuth(signIn)}>
          <LoginPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </AppProviders>,
  );
}

const emailInput = (): HTMLElement => screen.getByLabelText('Email', { selector: 'input' });
const passwordInput = (): HTMLElement => screen.getByLabelText('Пароль', { selector: 'input' });
const submitButton = (): HTMLElement => screen.getByRole('button', { name: 'Войти' });

describe('§8.3.1 login screen: «Email + пароль»', () => {
  it('shows heading «Вход», fields «Email» and «Пароль», button «Войти»', () => {
    renderLogin(vi.fn<AuthContextValue['signIn']>());

    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
    expect(emailInput()).toBeInTheDocument();
    expect(passwordInput()).toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
  });

  it('«Ссылки на регистрацию нет»: no link or text mentioning «Регистр»', () => {
    renderLogin(vi.fn<AuthContextValue['signIn']>());

    expect(screen.queryByRole('link', { name: /регистр/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/регистр/i)).not.toBeInTheDocument();
  });
});

describe('§8.3.1 «валидация непустых полей»', () => {
  it('submitting empty form shows «Введите email» and «Введите пароль» and does not call signIn', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn<AuthContextValue['signIn']>().mockResolvedValue(undefined);

    renderLogin(signIn);

    await user.click(submitButton());

    expect(await screen.findByText('Введите email')).toBeInTheDocument();
    expect(screen.getByText('Введите пароль')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('whitespace-only email shows «Введите email» and does not call signIn', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn<AuthContextValue['signIn']>().mockResolvedValue(undefined);

    renderLogin(signIn);

    await user.type(emailInput(), '   ');
    await user.type(passwordInput(), 'secret');
    await user.click(submitButton());

    expect(await screen.findByText('Введите email')).toBeInTheDocument();
    expect(screen.queryByText('Введите пароль')).not.toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe('§8.3.1 submit', () => {
  it('valid input calls signIn once with trimmed email and password as typed', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn<AuthContextValue['signIn']>().mockResolvedValue(undefined);

    renderLogin(signIn);

    await user.type(emailInput(), ' a@b.c ');
    await user.type(passwordInput(), ' pw ');
    await user.click(submitButton());

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledTimes(1);
    });

    expect(signIn).toHaveBeenCalledWith('a@b.c', ' pw ');
  });
});

describe('§8.3.1 errors: «ошибка «Неверный email или пароль»»', () => {
  it('invalid credentials (AuthApiError 400 invalid_credentials) shows «Неверный email или пароль»', async () => {
    const user = userEvent.setup();
    const signIn = vi
      .fn<AuthContextValue['signIn']>()
      .mockRejectedValue(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'));

    renderLogin(signIn);

    await user.type(emailInput(), 'a@b.c');
    await user.type(passwordInput(), 'wrong');
    await user.click(submitButton());

    expect(await screen.findByText('Неверный email или пароль')).toBeInTheDocument();
  });

  it('any other failure (network Error) shows «Не удалось выполнить действие»', async () => {
    const user = userEvent.setup();
    const signIn = vi
      .fn<AuthContextValue['signIn']>()
      .mockRejectedValue(new Error('Failed to fetch'));

    renderLogin(signIn);

    await user.type(emailInput(), 'a@b.c');
    await user.type(passwordInput(), 'pw');
    await user.click(submitButton());

    expect(await screen.findByText('Не удалось выполнить действие')).toBeInTheDocument();
    expect(screen.queryByText('Неверный email или пароль')).not.toBeInTheDocument();
  });
});
