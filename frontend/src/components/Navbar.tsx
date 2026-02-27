import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import RestaurantMenuOutlinedIcon from '@mui/icons-material/RestaurantMenuOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useMediaQuery, useTheme } from '@mui/material';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const sideLinkSx = {
  justifyContent: 'flex-start',
  textTransform: 'none',
  borderRadius: 2.5,
  minHeight: 44,
  py: 1.1,
  px: 1.5,
  color: 'text.secondary',
  fontWeight: 600,
  '&.active': {
    color: 'primary.main',
    backgroundColor: 'rgba(37, 99, 235, 0.10)'
  }
};

const topLinkSx = {
  minWidth: 0,
  px: 1.1,
  borderRadius: 2,
  color: 'text.secondary',
  '&.active': {
    color: 'primary.main',
    backgroundColor: 'rgba(37, 99, 235, 0.1)'
  }
};

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCollapsedSidebar = isDesktop && !isSidebarHovered;
  const collapsedRailWidth = 92;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSidebarEnter = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsSidebarHovered(true);
  };

  const handleSidebarLeave = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = setTimeout(() => {
      setIsSidebarHovered(false);
      collapseTimerRef.current = null;
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';
  const showManagement = isAdmin || isManager;

  const navItems: NavItem[] = [
    { to: '/', label: 'New Order', icon: <AddCircleOutlineIcon fontSize="small" /> },
    { to: '/orders', label: 'Orders', icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
    { to: '/customers', label: 'Customers', icon: <GroupOutlinedIcon fontSize="small" /> },
    { to: '/menu', label: 'Menu', icon: <RestaurantMenuOutlinedIcon fontSize="small" /> }
  ];

  if (showManagement) {
    navItems.push(
      { to: '/management', label: 'Insights', icon: <InsightsOutlinedIcon fontSize="small" /> },
      { to: '/user-settings', label: 'User Settings', icon: <ManageAccountsOutlinedIcon fontSize="small" /> }
    );
  }
  if (isAdmin) {
    navItems.push({ to: '/settings', label: 'Settings', icon: <SettingsOutlinedIcon fontSize="small" /> });
  }

  return (
    <>
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          bgcolor: '#ffffff'
        }}
      >
        <Typography sx={{ px: 1, fontWeight: 700 }}>Restaurant</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflowX: 'auto' }}>
          {navItems.map((item) => (
            <Tooltip key={item.to} title={item.label}>
              <Button component={NavLink} to={item.to} sx={topLinkSx}>
                {item.icon}
              </Button>
            </Tooltip>
          ))}
          <Tooltip title="Logout">
            <IconButton onClick={handleLogout} color="error" size="small">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'block' }, width: collapsedRailWidth, minWidth: collapsedRailWidth, position: 'relative', zIndex: 15 }}>
        <Box
          sx={{
            width: isCollapsedSidebar ? collapsedRailWidth : { md: 236, xl: 264 },
            minWidth: isCollapsedSidebar ? collapsedRailWidth : { md: 236, xl: 264 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: 1.4,
            borderRight: '1px solid rgba(37,99,235,0.14)',
            backgroundColor: '#eaf0ff',
            transition: 'width 200ms ease, min-width 200ms ease',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 20,
            willChange: 'width'
          }}
          onMouseEnter={handleSidebarEnter}
          onMouseLeave={handleSidebarLeave}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, px: 0.6, pt: 0.7, pb: 2, minHeight: 64 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.main',
                color: '#fff',
                fontWeight: 800,
                letterSpacing: '0.02em'
              }}
            >
              RU
            </Box>
            <Box
              sx={{
                minWidth: 0,
                whiteSpace: 'nowrap',
                opacity: isCollapsedSidebar ? 0 : 1,
                width: isCollapsedSidebar ? 0 : 'auto',
                overflow: 'hidden',
                transition: 'opacity 160ms ease'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                Restaurant UI
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Operations Console
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 0.8 }}>
            {navItems.map((item) => {
              return (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  title={isCollapsedSidebar ? item.label : undefined}
                  sx={{
                    ...sideLinkSx,
                    px: isCollapsedSidebar ? 1 : 1.5,
                    minWidth: 0
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: isCollapsedSidebar ? 'center' : 'flex-start' }}>
                    <Box sx={{ width: 20, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{item.icon}</Box>
                    <Box
                      sx={{
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        width: isCollapsedSidebar ? 0 : 'auto',
                        opacity: isCollapsedSidebar ? 0 : 1,
                        overflow: 'hidden',
                        ml: isCollapsedSidebar ? 0 : 1.2,
                        transition: 'opacity 140ms ease'
                      }}
                    >
                      {item.label}
                    </Box>
                  </Box>
                </Button>
              );
            })}
          </Box>

          <Box
            sx={{
              mt: 'auto',
              p: 1.1,
              minHeight: 104,
              borderRadius: 3,
              bgcolor: '#f7f9ff',
              border: '1px solid rgba(15,23,42,0.10)'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>
                {user.name[0]}
              </Avatar>
              <Box
                sx={{
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  width: isCollapsedSidebar ? 0 : 'auto',
                  overflow: 'hidden',
                  opacity: isCollapsedSidebar ? 0 : 1,
                  transition: 'opacity 160ms ease'
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.1 }} noWrap>
                  {user.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
                  {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Main Manager' : 'Staff'}
                </Typography>
              </Box>
              <Tooltip title="Logout">
                <IconButton onClick={handleLogout} size="small" color="error" sx={{ ml: 'auto' }}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              sx={{
                mt: 1,
                fontSize: 11,
                color: 'text.disabled',
                lineHeight: '16px',
                minHeight: 16,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                opacity: isCollapsedSidebar ? 0 : 1,
                transition: 'opacity 160ms ease'
              }}
            >
              Current route: {location.pathname}
            </Typography>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default Navbar;
