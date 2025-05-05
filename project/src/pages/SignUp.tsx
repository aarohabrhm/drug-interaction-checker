import { useState } from "react";
import { signupDoctor } from "../../utils/api";
import { useNavigate } from "react-router-dom";

export default function Signup() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [specialty, setSpecialty] = useState("");
    const [message, setMessage] = useState("");
    const navigate = useNavigate()

    const handleSignup = async () => {
        const result = await signupDoctor(username, password, specialty);
        if (result.error) {
            setMessage(result.error);
        } else {
            setMessage("Signup successful! You can now log in.");
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
              onClick={handleSignup}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
            >
              Sign Up
            </button>
          </div>
  
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
