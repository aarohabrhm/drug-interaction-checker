import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginDoctor } from "../../utils/api";

export function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const navigate = useNavigate()

    const handleLogin = async () => {
      const result = await loginDoctor(username, password);
  
      if (result.error) {
          setMessage("Invalid Username or Password");
      } else {
          localStorage.setItem("authToken", result.token);  // Store token for authentication
          navigate("/dashboard");
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

        {/* Form */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              type="text"
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
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
          >
            Sign In
          </button>
        </div>

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
