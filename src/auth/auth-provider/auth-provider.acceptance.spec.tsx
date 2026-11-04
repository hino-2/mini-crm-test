import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import {
  fetchProfile,
  signInWithPassword,
  signOut,
  subscribeToAuthChanges,
} from '../auth-api/auth-api';
import { useAuth } from '../auth-context/auth-context';
import type { Profile } from '../auth.type';
import { AuthProvider } from './auth-provider';

vi.mock('../auth-api/auth-api', () => ({
  subscribeToAuthChanges: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  fetchProfile: vi.fn(),
}));

const PROFILE: Profile = { id: 'u1', full_name: 'Иван Петров', role: 'manager' };
const SESSION = { user: { id: 'u1' } } as Session;
const unsubscribe = vi.fn();

let capturedCallback: ((session: Session | null) => void) | null = null;

// Тестовый хелпер: эмулирует событие onAuthStateChange.
function emitSession(session: Session | null): void {
  if (!capturedCallback) {
    throw new Error('subscribeToAuthChanges was not called');
  }

  const callback = capturedCallback;

  act(() => {
    callback(session);
  });
}

// Тестовый хелпер: выводит состояние useAuth().
function Probe(): JSX.Element {
  const auth = useAuth();

  return (
    <div>
      <p>{`status:${auth.status}`}</p>
      <p>{`profile:${auth.profile ? auth.profile.full_name : 'none'}`}</p>
      <button type="button" onClick={() => void auth.signIn('a@b.c', 'pw')}>
        probe-sign-in
      </button>
      <button type="button" onClick={() => void auth.signOut()}>
        probe-sign-out
      </button>
    </div>
  );
}

function renderProvider(): ReturnType<typeof render> {
  return render(
    <AppProviders>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </AppProviders>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  capturedCallback = null;
  vi.mocked(subscribeToAuthChanges).mockImplementation((callback) => {
    capturedCallback = callback;

    return unsubscribe;
  });
  vi.mocked(fetchProfile).mockResolvedValue(PROFILE);
  vi.mocked(signInWithPassword).mockResolvedValue(undefined);
  vi.mocked(signOut).mockResolvedValue(undefined);
});

describe('§8.1 AuthProvider: session + loaded profile', () => {
  it('is «loading» before the first auth event', () => {
    renderProvider();

    expect(subscribeToAuthChanges).toHaveBeenCalled();
    expect(screen.getByText('status:loading')).toBeInTheDocument();
    expect(screen.getByText('profile:none')).toBeInTheDocument();
  });

  it('null session → «unauthenticated», profile is not fetched', async () => {
    renderProvider();
    emitSession(null);

    expect(await screen.findByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('profile:none')).toBeInTheDocument();
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('session → fetchProfile(user id) → «authenticated» with the loaded profile', async () => {
    renderProvider();
    emitSession(SESSION);

    expect(await screen.findByText('status:authenticated')).toBeInTheDocument();
    expect(screen.getByText('profile:Иван Петров')).toBeInTheDocument();
    expect(fetchProfile).toHaveBeenCalledWith('u1');
  });

  it('session then null (signed out) → «unauthenticated», profile cleared', async () => {
    renderProvider();
    emitSession(SESSION);

    await screen.findByText('status:authenticated');

    emitSession(null);

    expect(await screen.findByText('status:unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('profile:none')).toBeInTheDocument();
  });

  it('useAuth().signIn(email, password) delegates to signInWithPassword(email, password)', async () => {
    const user = userEvent.setup();

    renderProvider();
    emitSession(null);

    await user.click(screen.getByRole('button', { name: 'probe-sign-in' }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith('a@b.c', 'pw');
    });
  });

  it('useAuth().signOut() delegates to auth-api signOut', async () => {
    const user = userEvent.setup();

    renderProvider();
    emitSession(SESSION);

    await screen.findByText('status:authenticated');
    await user.click(screen.getByRole('button', { name: 'probe-sign-out' }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  it('unmount unsubscribes from auth changes', () => {
    const { unmount } = renderProvider();

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('useAuth outside AuthProvider', () => {
  it('throws «useAuth must be used within AuthProvider»', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow('useAuth must be used within AuthProvider');

    consoleError.mockRestore();
  });
});
