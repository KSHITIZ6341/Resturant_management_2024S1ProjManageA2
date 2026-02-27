import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { AuthProvider } from './context/AuthContext';
import theme from './theme';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/auth/ProtectedRoute';

const AddOrderPage = lazy(() => import('./pages/AddOrderPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const CustomerPage = lazy(() => import('./pages/CustomerPage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ManagementDashboardPage = lazy(() => import('./pages/ManagementDashboardPage'));
const UserSettingsPage = lazy(() => import('./pages/UserSettingsPage'));

function App() {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <AuthProvider>
          <CssBaseline />
          <BrowserRouter>
            <Box
              sx={{
                minHeight: '100vh',
                width: '100%',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                backgroundColor: '#f8faff'
              }}
            >
              <Navbar />
              <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto', minWidth: 0, backgroundColor: '#fcfdff' }}>
                <Suspense
                  fallback={
                    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
                      <CircularProgress size={32} />
                    </Box>
                  }
                >
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<ProtectedRoute><AddOrderPage /></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute><OrderPage /></ProtectedRoute>} />
                    <Route path="/orders/new" element={<ProtectedRoute><AddOrderPage /></ProtectedRoute>} />
                    <Route path="/customers" element={<ProtectedRoute><CustomerPage /></ProtectedRoute>} />
                    <Route path="/menu" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
                    <Route path="/management" element={<ProtectedRoute role={['admin', 'manager']}><ManagementDashboardPage /></ProtectedRoute>} />
                    <Route path="/user-settings" element={<ProtectedRoute role={['admin', 'manager']}><UserSettingsPage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute role="admin"><SettingsPage /></ProtectedRoute>} />
                  </Routes>
                </Suspense>
              </Box>
            </Box>
          </BrowserRouter>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
