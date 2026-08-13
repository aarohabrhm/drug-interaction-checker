import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '../components/common/PasswordInput';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '../components/layout/AuthLayout';
import { loginDoctor } from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useDocumentMeta('SafeMeds | Sign in');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setMessage('Enter your username and password.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      // loginDoctor stores the token itself; the previous copy of that write
      // here meant two places had to agree on the storage key.
      await loginDoctor(username, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/dashboard', { replace: true });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Invalid username or password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Continue to your patients and prescriptions."
      footer={
        <>
          No account?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {/* A real <form> so Enter submits and password managers work. */}
      <form className="space-y-4" onSubmit={handleLogin}>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
          />
        </div>

        {message && (
          <p
            role="alert"
            className="rounded-md border-l-4 border-sev-contraindicated-border bg-sev-contraindicated-bg px-3 py-2 text-sm text-sev-contraindicated"
          >
            {message}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Login;
