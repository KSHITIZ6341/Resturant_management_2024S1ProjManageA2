import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Divider, Stack, Typography } from '@mui/material';
import DotGrid from '../components/DotGrid';
import { useAuth } from '../context/AuthContext';
import type { UserAccount } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, user, users } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    if (user.role === 'admin' || user.role === 'manager') {
      navigate('/management', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  const adminUsers = useMemo(() => users.filter((account) => account.role === 'admin'), [users]);
  const managerUsers = useMemo(() => users.filter((account) => account.role === 'manager'), [users]);
  const staffUsers = useMemo(() => users.filter((account) => account.role === 'staff'), [users]);

  const attemptLogin = (account: UserAccount) => {
    setError(null);
    let passwordValue: string | undefined;

    if (account.password && account.password.length > 0) {
      const provided = window.prompt(`Enter password for ${account.name}`);
      if (provided === null || provided.length === 0) {
        setError('Password is required to sign in.');
        return;
      }
      passwordValue = provided;
    }

    const success = login(account.id, passwordValue);
    if (!success) {
      setError('Unable to sign in. Please check the credentials and try again.');
    }
  };

  const renderUserButtons = (accounts: UserAccount[], color: string) => (
    <Stack spacing={1.5} alignItems="center">
      {accounts.map((account) => (
        <Button
          key={account.id}
          fullWidth
          size="large"
          variant="contained"
          onClick={() => attemptLogin(account)}
          sx={{
            py: 1.4,
            fontWeight: 600,
            letterSpacing: '0.03em',
            maxWidth: 320,
            mx: 'auto',
            background: color,
            boxShadow: '0 12px 25px rgba(15, 23, 42, 0.25)',
            '&:hover': {
              filter: 'brightness(1.05)'
            }
          }}
        >
          {account.name}
        </Button>
      ))}
    </Stack>
  );

  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 3,
        minHeight: { xs: '70vh', md: '100%' },
        background: 'radial-gradient(circle at top left, #1e3a8a 0%, #111827 45%, #020617 100%)'
      }}
    >
      <DotGrid className="absolute inset-0" style={{ opacity: 0.4 }} />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(79,70,229,0.45), rgba(14,116,144,0.25))',
          mixBlendMode: 'screen',
          pointerEvents: 'none'
        }}
      />
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 520,
          px: { xs: 3, sm: 4 },
          py: { xs: 4, sm: 5 }
        }}
      >
        <Box
          sx={{
            backdropFilter: 'blur(18px)',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 25px 45px rgba(15, 23, 42, 0.5)',
            p: { xs: 4, sm: 5 },
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            textAlign: 'center'
          }}
        >
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.75rem', sm: '2rem' },
                color: 'rgba(255,255,255,0.95)'
              }}
            >
              Welcome Back
            </Typography>
            <Typography sx={{ mt: 1, color: 'rgba(226,232,240,0.75)' }}>
              Select your profile to continue. Admins and Main Managers will access the management overview.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" variant="filled" sx={{ bgcolor: 'rgba(239,68,68,0.85)' }}>
              {error}
            </Alert>
          )}

          {adminUsers.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ color: 'rgba(226,232,240,0.9)', mb: 1 }}>
                Admin
              </Typography>
              {renderUserButtons(adminUsers, 'linear-gradient(135deg, #ec4899, #ef4444)')}
            </Box>
          )}

          {managerUsers.length > 0 && (
            <>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)' }}>
                <Typography sx={{ color: 'rgba(226,232,240,0.6)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.12em' }}>
                  Main Managers
                </Typography>
              </Divider>
              {renderUserButtons(managerUsers, 'linear-gradient(135deg, #6366f1, #7c3aed)')}
            </>
          )}

          {staffUsers.length > 0 && (
            <>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.25)' }}>
                <Typography sx={{ color: 'rgba(226,232,240,0.6)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.12em' }}>
                  Staff
                </Typography>
              </Divider>
              {renderUserButtons(staffUsers, 'linear-gradient(135deg, #0ea5e9, #2563eb)')}
            </>
          )}

          {adminUsers.length === 0 && managerUsers.length === 0 && staffUsers.length === 0 && (
            <Typography sx={{ color: 'rgba(226,232,240,0.75)' }}>
              No users available. Please contact an administrator.
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
