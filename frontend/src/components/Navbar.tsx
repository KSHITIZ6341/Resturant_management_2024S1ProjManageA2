import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import LogoutIcon from '@mui/icons-material/Logout';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import SettingsIcon from '@mui/icons-material/Settings';

const activeLinkStyle = {
  fontWeight: 'bold',
  textDecoration: 'underline',
  textDecorationThickness: '2px',
  textUnderlineOffset: '4px'
};

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';
  const showManagement = isAdmin || isManager;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ gap: 2 }}>
          <RestaurantMenuIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography
            variant="h6"
            component={NavLink}
            to="/"
            sx={{
              mr: 4,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.1rem',
              color: 'inherit',
              textDecoration: 'none'
            }}
          >
            Restaurant MS
          </Typography>

          <Box component="nav" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button component={NavLink} to="/" sx={{ color: 'text.primary' }} style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}>
              New Order
            </Button>
            <Button component={NavLink} to="/orders" sx={{ color: 'text.primary' }} style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}>
              Orders
            </Button>
            <Button component={NavLink} to="/customers" sx={{ color: 'text.primary' }} style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}>
              Customers
            </Button>
            <Button component={NavLink} to="/menu" sx={{ color: 'text.primary' }} style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}>
              Menu
            </Button>
            {showManagement && (
              <Button component={NavLink} to="/management" sx={{ color: 'text.primary' }} style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}>
                Insights
              </Button>
            )}
            {showManagement && (
              <Button component={NavLink} to="/user-settings" sx={{ color: 'text.primary' }} style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}>
                User Settings
              </Button>
            )}
            {isAdmin && (
              <IconButton component={NavLink} to="/settings" sx={{ ml: 1 }} aria-label="Email Settings">
                <SettingsIcon />
              </IconButton>
            )}
          </Box>

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label={`${user.name} \u2022 ${user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Main Manager' : 'Staff'}`}
              color={isAdmin ? 'primary' : isManager ? 'secondary' : 'default'}
              variant={isAdmin || isManager ? 'filled' : 'outlined'}
            />
            <IconButton onClick={handleLogout} color="error" aria-label="Log out">
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
