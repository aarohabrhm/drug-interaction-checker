import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '../components/common/PasswordInput';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '../components/layout/AuthLayout';
import { ApiError, signupDoctor } from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [message, setMessage] = useState('');
  const [succeeded, setSucceeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useDocumentMeta('SafeMeds | Create account');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      await signupDoctor(username, password, specialty);
      setSucceeded(true);
      setMessage('Account created. Taking you to sign in…');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (error) {
      setSucceeded(false);
      // The API rejects weak passwords via Django's validators; show the
      // specific reasons rather than a generic failure.
      if (error instanceof ApiError && error.fields) {
        setMessage(Object.values(error.fields).flat().join(' '));
      } else {
        setMessage(error instanceof Error ? error.message : 'Signup failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="For prescribers screening their own patients."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSignup}>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose a username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
          />
          <p className="text-xs text-muted-foreground">
            At least 10 characters, and not a commonly used password.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="specialty">Specialty</Label>
          <Input
            id="specialty"
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
            placeholder="General practice"
          />
        </div>

        {message && (
          <p
            role="alert"
            className={
              succeeded
                ? 'rounded-md border-l-4 border-sev-clear-border bg-sev-clear-bg px-3 py-2 text-sm text-sev-clear'
                : 'rounded-md border-l-4 border-sev-contraindicated-border bg-sev-contraindicated-bg px-3 py-2 text-sm text-sev-contraindicated'
            }
          >
            {message}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
