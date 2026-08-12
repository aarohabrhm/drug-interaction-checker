import { useState } from "react";
import { ApiError, signupDoctor } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export default function Signup() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [specialty, setSpecialty] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    useDocumentMeta("SafeMeds | Create account");

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");
        try {
            await signupDoctor(username, password, specialty);
            setMessage("Signup successful! Redirecting to sign in…");
            setTimeout(() => navigate("/login", { replace: true }), 1200);
        } catch (error) {
            // The API rejects weak passwords via Django's validators; show the
            // specific reasons rather than a generic failure.
            if (error instanceof ApiError && error.fields) {
                setMessage(Object.values(error.fields).flat().join(" "));
            } else {
                setMessage(error instanceof Error ? error.message : "Signup failed.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
         <div className="bg-gray-50 rounded-3xl shadow-xl p-8 w-full max-w-md border-2 border-white">
          {/* Header */}
          <div className="text-center mb-8 flex flex-col items-center">
            <img 
              src="/logo.png" 
              alt="SafeMeds Logo"
              className="h-12 w-12 mb-4"
            />
            <h2 className="text-3xl font-bold text-gray-800">SafeMeds</h2>
            <p className="text-gray-600 mt-2">Create your doctor account</p>
          </div>
  
          {/* Form */}
          <form className="space-y-6" onSubmit={handleSignup}>
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
                autoComplete="new-password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialty
              </label>
              <input
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                type="text"
                placeholder="Enter your medical specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              />
            </div>
  
            {/* Message */}
            {message && (
              <div className={`text-sm text-center p-2 rounded-lg ${
                message.includes('successful') 
                  ? 'text-green-500 bg-green-50' 
                  : 'text-red-500 bg-red-50'
              }`}>
                {message}
              </div>
            )}
  
            {/* Signup Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 disabled:bg-gray-400 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
            >
              {submitting ? "Creating account…" : "Sign Up"}
            </button>
          </form>
  
          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a
                onClick={() => navigate("/")}
                className="text-blue-600 text-sm hover:underline cursor-pointer"
                >
                Sign in
              </a>

            </p>
          </div>
        </div>
      </div>
    );
}
