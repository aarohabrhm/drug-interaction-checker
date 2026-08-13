import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';

vi.mock('../../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/api')>();
  return { ...actual, loginDoctor: vi.fn() };
});

const { loginDoctor } = await import('../../utils/api');
const mockLogin = vi.mocked(loginDoctor);

/** Renders login, with a stand-in for wherever it navigates next. */
function renderLogin(state?: { from?: string }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<p>Dashboard screen</p>} />
        <Route path="/patients" element={<p>Patients screen</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Login', () => {
  beforeEach(() => {
    mockLogin.mockReset().mockResolvedValue({
      token: 't',
      username: 'demodoctor',
      specialty: 'General Practice',
    });
  });

  it('signs in and lands on the dashboard', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/username/i), 'demodoctor');
    await user.type(screen.getByLabelText('Password'), 'demopass123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('Dashboard screen')).toBeInTheDocument();
  });

  it('returns to the page that required signing in', async () => {
    // ProtectedRoute records where the visitor was headed; losing it would
    // dump them on the dashboard every time their token expired.
    const user = userEvent.setup();
    renderLogin({ from: '/patients' });

    await user.type(screen.getByLabelText(/username/i), 'demodoctor');
    await user.type(screen.getByLabelText('Password'), 'demopass123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('Patients screen')).toBeInTheDocument();
  });

  it('does not call the API with an empty field', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(mockLogin).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/enter your username and password/i);
  });

  it('shows why a sign-in failed', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid username or password.'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/username/i), 'demodoctor');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid username or password/i)
    );
    // Still on the form, not silently navigated away.
    expect(screen.queryByText('Dashboard screen')).not.toBeInTheDocument();
  });
});
