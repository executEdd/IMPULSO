import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RedSemaphorePage } from './pages/admin/RedSemaphorePage';
import { SchedulesPage } from './pages/admin/SchedulesPage';
import { QrScannerPage } from './pages/teacher/QrScannerPage';
import { GradesPage } from './pages/GradesPage';
import { MyQrPage } from './pages/student/MyQrPage';
import { StudentSchedulePage } from './pages/student/StudentSchedulePage';
import { ParentDashboardPage } from './pages/parent/ParentDashboardPage';
import { NotificationsPage } from './pages/NotificationsPage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/red-semaphore" element={<ProtectedRoute allowedRoles={['ADMIN']}><RedSemaphorePage /></ProtectedRoute>} />
                    <Route path="/schedules" element={<SchedulesPage />} />
                    <Route path="/scan-qr" element={<ProtectedRoute allowedRoles={['TEACHER']}><QrScannerPage /></ProtectedRoute>} />
                    <Route path="/grades" element={<GradesPage />} />
                    <Route path="/my-qr" element={<ProtectedRoute allowedRoles={['STUDENT']}><MyQrPage /></ProtectedRoute>} />
                    <Route path="/student-schedule" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentSchedulePage /></ProtectedRoute>} />
                    <Route path="/parent-dashboard" element={<ProtectedRoute allowedRoles={['PARENT']}><ParentDashboardPage /></ProtectedRoute>} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
