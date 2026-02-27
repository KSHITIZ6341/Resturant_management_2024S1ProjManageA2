import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import type { UserAccount, UserRole } from '../context/AuthContext';

const ROLE_ORDER: Record<UserRole, number> = {
  admin: 0,
  manager: 1,
  staff: 2
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Main Manager',
  staff: 'Staff'
};

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, user, users } = useAuth();
  const navigate = useNavigate();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [password, setPassword] = useState('');
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

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        if (ROLE_ORDER[a.role] !== ROLE_ORDER[b.role]) {
          return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
        }
        return a.name.localeCompare(b.name);
      }),
    [users]
  );

  useEffect(() => {
    if (!selectedUserId || !sortedUsers.some((account) => account.id === selectedUserId)) {
      setSelectedUserId(sortedUsers[0]?.id || '');
      setPassword('');
    }
  }, [selectedUserId, sortedUsers]);

  const selectedAccount = sortedUsers.find((account) => account.id === selectedUserId) || null;
  const needsPassword = Boolean(selectedAccount?.password);

  const handleSignIn = () => {
    setError(null);
    if (!selectedAccount) {
      setError('Select an account first.');
      return;
    }

    if (needsPassword && !password.trim()) {
      setError('Password is required for this account.');
      return;
    }

    const success = login(selectedAccount.id, needsPassword ? password : undefined);
    if (!success) {
      setError('Login failed. Check your password and try again.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: { xs: 'calc(100vh - 64px)', md: '100%' },
        display: 'grid',
        placeItems: 'center'
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 1120,
          borderRadius: 4,
          border: '1px solid rgba(15,23,42,0.08)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.35fr 1fr' }
        }}
      >
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            borderRight: { lg: '1px solid rgba(15,23,42,0.08)' },
            display: 'grid',
            gap: 2.5,
            backgroundColor: '#f7f9ff'
          }}
        >
          <Typography variant="h4" sx={{ lineHeight: 1.05 }}>
            Good Evening
          </Typography>
          <Typography color="text.secondary">
            Welcome to the operations workspace. Sign in with your account to manage orders,
            customer records, menu updates, and reporting.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.4 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                color: '#fff',
                background: 'linear-gradient(140deg, #2563eb, #3b82f6)'
              }}
            >
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Active Orders
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.6, fontWeight: 800 }}>
                2.2k
              </Typography>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                color: '#fff',
                background: 'linear-gradient(140deg, #a855f7, #c084fc)'
              }}
            >
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Processed
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.6, fontWeight: 800 }}>
                534
              </Typography>
            </Paper>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid rgba(15,23,42,0.08)',
              backgroundColor: '#ffffff'
            }}
          >
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
              Quick Access
            </Typography>
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 600 }}>Admin credentials: <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>admin / admin</Box></Typography>
              <Typography sx={{ fontWeight: 600 }}>Manager credentials: <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>manager / manager</Box></Typography>
            </Stack>
          </Paper>
        </Box>

        <Box sx={{ p: { xs: 3, md: 4 }, display: 'grid', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Sign In
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={1}>
            {sortedUsers.map((account: UserAccount) => (
              <Button
                key={account.id}
                variant={selectedUserId === account.id ? 'contained' : 'outlined'}
                onClick={() => {
                  setSelectedUserId(account.id);
                  setPassword('');
                  setError(null);
                }}
                sx={{
                  justifyContent: 'space-between',
                  py: 1.1,
                  borderColor: 'rgba(15,23,42,0.12)'
                }}
              >
                <span>{account.name}</span>
                <span style={{ opacity: 0.82 }}>{ROLE_LABEL[account.role]}</span>
              </Button>
            ))}
          </Stack>

          <TextField
            label="Password"
            type="password"
            disabled={!needsPassword}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            helperText={needsPassword ? 'Required for selected account.' : 'No password required for this account.'}
            autoComplete="current-password"
            fullWidth
          />

          <Button variant="contained" size="large" onClick={handleSignIn} disabled={!selectedAccount}>
            Continue
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginPage;
