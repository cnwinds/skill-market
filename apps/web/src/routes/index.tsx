import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from '../components/Layout';
import { RequireAuth, RequireAdmin } from './guards';

import HomePage from '../features/skills/HomePage';
import SkillListPage from '../features/skills/SkillListPage';
import SkillDetailPage from '../features/skills/SkillDetailPage';
import LoginPage from '../features/auth/LoginPage';
import PublishPage from '../features/publisher/PublishPage';
import PublisherLayout from '../features/publisher/PublisherLayout';
import MySkillsPage from '../features/publisher/MySkillsPage';
import SubmissionPage from '../features/publisher/SubmissionPage';
import PublishKeysPage from '../features/publisher/PublishKeysPage';
import CreateWorkspacePage from '../features/editor/CreateWorkspacePage';
import SkillEditorPage from '../features/editor/SkillEditorPage';
import AdminLayout from '../features/admin/AdminLayout';
import ReviewQueuePage from '../features/admin/ReviewQueuePage';
import ReviewDetailPage from '../features/admin/ReviewDetailPage';
import MarketPage from '../features/market/MarketPage';

function RootLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="skills" element={<SkillListPage />} />
          <Route path="skills/:publisher/:name" element={<SkillDetailPage />} />
          <Route path="market" element={<MarketPage />} />

          <Route
            path="publish"
            element={
              <RequireAuth>
                <PublishPage />
              </RequireAuth>
            }
          />

          <Route
            path="publisher/skills/:publisher/:name/edit"
            element={
              <RequireAuth>
                <CreateWorkspacePage />
              </RequireAuth>
            }
          />
          <Route
            path="publisher/edit-workspaces/:id"
            element={
              <RequireAuth>
                <SkillEditorPage />
              </RequireAuth>
            }
          />

          {/* Publisher section */}
          <Route
            path="publisher"
            element={
              <RequireAuth>
                <PublisherLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="skills" replace />} />
            <Route path="skills" element={<MySkillsPage />} />
            <Route path="submissions/:id" element={<SubmissionPage />} />
            <Route path="keys" element={<PublishKeysPage />} />
          </Route>

          {/* Admin section */}
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Navigate to="reviews" replace />} />
            <Route path="reviews" element={<ReviewQueuePage />} />
            <Route path="reviews/:id" element={<ReviewDetailPage />} />
          </Route>

          <Route
            path="*"
            element={
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="text-5xl mb-4">🔍</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">404 页面不存在</h2>
                <a href="/" className="text-blue-600 hover:underline text-sm">返回首页</a>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
