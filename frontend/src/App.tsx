import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { AuthProvider } from './context/AuthContext';
import theme from './theme';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AddOrderPage from './pages/AddOrderPage';
import OrderPage from './pages/OrderPage';
import CustomerPage from './pages/CustomerPage';
import MenuPage from './pages/MenuPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';

import UserSettingsPage from './pages/UserSettingsPage';
import ManagementDashboardPage from './pages/ManagementDashboardPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <AuthProvider>
          <CssBaseline />
          <BrowserRouter>
            <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
              <Navbar />
              <Box component="main" sx={{ flex: 1, padding: { xs: 2, md: 3 }, backgroundColor: '#ffffff' }}>
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
              </Box>
            </Box>
          </BrowserRouter>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
