import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loginDoctor } from "../../utils/api";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useDocumentMeta("SafeMeds | Sign in");

    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !password) {
        setMessage("Enter your username and password.");
        return;
      }

      setSubmitting(true);
      setMessage("");
      try {
        // loginDoctor stores the token itself; the previous copy of that write
        // here meant two places had to agree on the storage key.
        await loginDoctor(username, password);
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from ?? "/dashboard", { replace: true });
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Invalid username or password."
        );
      } finally {
        setSubmitting(false);
      }
  };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-2xl shadow-xl p-8 w-full max-w-md border-2 border-white">
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
        <img src="/logo.png" className="h-12 w-12 flex mb-4"></img>
          <h2 className="text-3xl font-bold text-gray-800">SafeMeds</h2>
          <p className="text-gray-600 mt-2">Please sign in to continue</p>
        </div>

        {/* Form -- a real <form> so Enter submits and password managers work */}
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              type="text"
              name="username"
              autoComplete="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Error Message */}
          {message && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
              {message}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 disabled:bg-gray-400 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Additional Links */}
        <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
              Didn't have an account?{' '}
              <a
                onClick={() => navigate("/signup")}
                className="text-blue-600 text-sm hover:underline cursor-pointer"
                >
                Sign up
              </a>

          </p>

        </div>
      </div>
    </div>
    );
}
