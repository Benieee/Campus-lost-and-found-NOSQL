import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AssistantPage } from './pages/AssistantPage';
import { DashboardPage } from './pages/DashboardPage';
import { FoundItemsPage } from './pages/FoundItemsPage';
import { HomePage } from './pages/HomePage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { LoginPage } from './pages/LoginPage';
import { LostItemsPage } from './pages/LostItemsPage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportFoundPage } from './pages/ReportFoundPage';
import { ReportLostPage } from './pages/ReportLostPage';
import { SubmitClaimPage } from './pages/SubmitClaimPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/found" element={<FoundItemsPage />} />
            <Route path="/found/:id" element={<ItemDetailPage kind="found" />} />
            <Route path="/lost" element={<LostItemsPage />} />
            <Route path="/lost/:id" element={<ItemDetailPage kind="lost" />} />
            <Route path="/assistant" element={<AssistantPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report-lost"
              element={
                <ProtectedRoute>
                  <ReportLostPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report-found"
              element={
                <ProtectedRoute>
                  <ReportFoundPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-submissions"
              element={
                <ProtectedRoute>
                  <MySubmissionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/claims/new/:foundItemId"
              element={
                <ProtectedRoute>
                  <SubmitClaimPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
