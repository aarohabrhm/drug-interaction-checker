import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AUTH_TOKEN_KEY } from '../../utils/api';
import { ProtectedRoute } from './ProtectedRoute';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <p>Secret dashboard</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to login when no token is present', () => {
    renderAt('/dashboard');
    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('renders the protected content when a token is present', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'a-token');
    renderAt('/dashboard');
    expect(screen.getByText('Secret dashboard')).toBeInTheDocument();
  });

  it('treats an empty token as unauthenticated', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, '');
    renderAt('/dashboard');
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('reads the same storage key the API client writes', () => {
    // Regression: login wrote "authToken" while the dashboard read "token",
    // so the profile never loaded. Both now go through AUTH_TOKEN_KEY.
    expect(AUTH_TOKEN_KEY).toBe('authToken');
  });
});
