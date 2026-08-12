import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import './global.css';

// Route-level code splitting: each screen is its own chunk, so the landing page
// no longer ships the dashboard, the prescription form and jsPDF up front.
const Home = lazy(() => import('./pages/landing'));
const Signup = lazy(() => import('./pages/SignUp'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PrescriptionHistory = lazy(() => import('./pages/PrescriptionHistory'));
// These two are named exports; React.lazy needs a module with a `default`.
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const AddPrescription = lazy(() =>
  import('./pages/AddPrescription').then((m) => ({ default: m.AddPrescription }))
);

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-500">Loading…</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-2">
      <h1 className="text-2xl font-bold text-gray-800">Page not found</h1>
      <a href="/" className="text-blue-600 hover:underline">
        Back to home
      </a>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/prescription"
            element={
              <ProtectedRoute>
                <AddPrescription />
              </ProtectedRoute>
            }
          />
          <Route
            path="/prescriptions"
            element={
              <ProtectedRoute>
                <PrescriptionHistory />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
