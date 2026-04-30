import { AuthProvider } from './features/auth/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import AppRouter from './routes';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
