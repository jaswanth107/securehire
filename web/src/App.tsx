import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { CandidateDetailPage } from './pages/CandidateDetailPage';
import { RequisitionsPage } from './pages/RequisitionsPage';
import { RequisitionDetailPage } from './pages/RequisitionDetailPage';
import { UsersPage } from './pages/UsersPage';
import { ActivityPage } from './pages/ActivityPage';
import { PreviewPage } from './pages/PreviewPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidates"
        element={
          <ProtectedRoute>
            <CandidatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidates/:id"
        element={
          <ProtectedRoute>
            <CandidateDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requisitions"
        element={
          <ProtectedRoute roles={['ADMIN', 'RECRUITER']}>
            <RequisitionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requisitions/:id"
        element={
          <ProtectedRoute roles={['ADMIN', 'RECRUITER']}>
            <RequisitionDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity"
        element={
          <ProtectedRoute>
            <ActivityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/preview"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <PreviewPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/404"
        element={
          <ProtectedRoute>
            <NotFoundPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
