import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!user) {
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!user) {
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  if (!user.roles.includes('admin')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">🚫</div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1">403 无权限</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">此页面仅限管理员访问</p>
      </div>
    );
  }
  return <>{children}</>;
}
