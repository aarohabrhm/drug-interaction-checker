import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { Toaster } from './components/ui/sonner';
import { Skeleton } from './components/ui/skeleton';

// Route-level code splitting: each screen is its own chunk, so the landing page
// no longer ships the dashboard, the prescription form and jsPDF up front.
const Home = lazy(() => import('./pages/landing'));
const Signup = lazy(() => import('./pages/SignUp'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PrescriptionHistory = lazy(() => import('./pages/PrescriptionHistory'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
// These two are named exports; React.lazy needs a module with a `default`.
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const AddPrescription = lazy(() =>
  import('./pages/AddPrescription').then((m) => ({ default: m.AddPrescription }))
);

/**
 * Shaped like a page rather than a spinner, so the layout does not jump when
 * the chunk lands.
 */
function RouteFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface px-6">
      <div className="text-center">
        <p className="text-label uppercase tracking-wide text-muted-foreground">404</p>
        <h1 className="mt-2 text-display text-foreground">This page does not exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be out of date, or the page may have moved.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Home />
            </Suspense>
          }
        />
        <Route
          path="/login"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Login />
            </Suspense>
          }
        />
        <Route
          path="/signup"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Signup />
            </Suspense>
          }
        />

        {/* Everything behind the shell requires a session. */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/check"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AddPrescription />
              </Suspense>
            }
          />
          <Route
            path="/patients"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Patients />
              </Suspense>
            }
          />
          <Route
            path="/patients/:patientId"
            element={
              <Suspense fallback={<RouteFallback />}>
                <PatientDetail />
              </Suspense>
            }
          />
          <Route
            path="/prescriptions"
            element={
              <Suspense fallback={<RouteFallback />}>
                <PrescriptionHistory />
              </Suspense>
            }
          />
          {/* Existing links and bookmarks point at the old path. */}
          <Route path="/prescription" element={<Navigate to="/check" replace />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>

      <Toaster />
    </BrowserRouter>
  );
}

export default App;
