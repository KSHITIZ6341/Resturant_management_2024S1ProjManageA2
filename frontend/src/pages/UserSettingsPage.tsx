import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import Grid from '@mui/material/Grid';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from '../context/AuthContext';
import type { UserAccount, UserRole } from '../context/AuthContext';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Main Manager',
  staff: 'Staff'
};

const UserSettingsPage: React.FC = () => {
  const { users, user: currentUser, addUser, updateUser, removeUser } = useAuth();
  const [newUser, setNewUser] = useState({ name: '', role: 'staff' as UserRole, password: '' });
  const [feedback, setFeedback] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const availableRolesForCurrentUser = useMemo<UserRole[]>(() => {
    if (currentUser?.role === 'admin') {
      return ['staff', 'manager', 'admin'];
    }
    return ['staff', 'manager'];
  }, [currentUser?.role]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.role === b.role) {
        return a.name.localeCompare(b.name);
      }
      const roleOrder: Record<UserRole, number> = { admin: 0, manager: 1, staff: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });
  }, [users]);

  const resetFeedback = () => setFeedback(null);

  const handleAddUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    const payload = {
      name: newUser.name,
      role: newUser.role,
      password: newUser.password || undefined
    };

    const result = addUser(payload);
    if (result.success) {
      setFeedback({ message: 'User added successfully.', severity: 'success' });
      setNewUser({ name: '', role: availableRolesForCurrentUser[0] ?? 'staff', password: '' });
    } else {
      setFeedback({ message: result.message ?? 'Unable to add user.', severity: 'error' });
    }
  };

  const handleRoleChange = (account: UserAccount, role: UserRole) => {
    resetFeedback();

    if (account.role === role) {
      return;
    }

    const result = updateUser(account.id, { role });
    if (result.success) {
      setFeedback({ message: `${account.name}'s role updated to ${ROLE_LABELS[role]}.`, severity: 'success' });
    } else {
      setFeedback({ message: result.message ?? 'Unable to update role.', severity: 'error' });
    }
  };

  const handleRename = (account: UserAccount) => {
    resetFeedback();
    const proposed = window.prompt('Rename user', account.name);
    if (proposed === null) {
      return;
    }
    const result = updateUser(account.id, { name: proposed });
    if (result.success) {
      setFeedback({ message: 'User name updated.', severity: 'success' });
    } else {
      setFeedback({ message: result.message ?? 'Unable to update user.', severity: 'error' });
    }
  };

  const handlePasswordChange = (account: UserAccount) => {
    resetFeedback();
    const promptLabel = account.password ? 'Update password (leave blank to remove)' : 'Set password (leave blank for none)';
    const proposed = window.prompt(promptLabel, account.password ?? '');
    if (proposed === null) {
      return;
    }

    const result = updateUser(account.id, { password: proposed.trim() || undefined });
    if (result.success) {
      const message = proposed.trim() ? 'Password updated.' : 'Password removed.';
      setFeedback({ message, severity: 'success' });
    } else {
      setFeedback({ message: result.message ?? 'Unable to update password.', severity: 'error' });
    }
  };

  const handleRemoveUser = (account: UserAccount) => {
    resetFeedback();
    const confirmed = window.confirm(`Remove ${account.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const result = removeUser(account.id);
    if (result.success) {
      setFeedback({ message: 'User removed.', severity: 'success' });
    } else {
      setFeedback({ message: result.message ?? 'Unable to remove user.', severity: 'error' });
    }
  };

  const roleOptionsForNewUser = availableRolesForCurrentUser.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" gutterBottom>
          User Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Add teammates, adjust roles, and manage access. Main Managers can manage staff accounts, while Admins have full control.
        </Typography>
      </Box>

      {feedback && (
        <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardHeader title="Add New User" subheader="Create a login for a staff member or manager." />
            <CardContent>
              <Stack component="form" spacing={2.5} onSubmit={handleAddUser}>
                <TextField
                  label="Name"
                  value={newUser.name}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  autoComplete="off"
                />
                <TextField
                  select
                  label="Role"
                  value={newUser.role}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value as UserRole }))}
                >
                  {roleOptionsForNewUser.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Password (optional)"
                  type="password"
                  value={newUser.password}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                  helperText="Leave blank for passwordless quick login."
                />
                <Button type="submit" variant="contained">
                  Add User
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardHeader title="Existing Users" subheader="Update roles, passwords, or remove accounts." />
            <CardContent>
              <Stack spacing={2}>
                {sortedUsers.map((account) => {
                  const isPrimaryAdmin = account.id === 'admin';
                  const isAdminUser = account.role === 'admin';
                  const canElevateToAdmin = currentUser?.role === 'admin';
                  const roleOptions: UserRole[] = canElevateToAdmin
                    ? (isPrimaryAdmin ? (['admin'] as UserRole[]) : (['admin', 'manager', 'staff'] as UserRole[]))
                    : (isAdminUser ? (['admin'] as UserRole[]) : (['manager', 'staff'] as UserRole[]));
                  const canEditRole = canElevateToAdmin ? !isPrimaryAdmin : !isAdminUser;
                  const canEdit = canElevateToAdmin ? !isPrimaryAdmin : !isAdminUser;
                  const disableRemoval = isPrimaryAdmin || account.id === currentUser?.id || (isAdminUser && !canElevateToAdmin);

                  return (
                    <Box
                      key={account.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        flexWrap: 'wrap',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: 2,
                        padding: 2,
                        backgroundColor: 'rgba(249,250,251,0.6)'
                      }}
                    >
                      <Box sx={{ minWidth: 160 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {account.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {ROLE_LABELS[account.role]}
                        </Typography>
                      </Box>

                      <TextField
                        select
                        label="Role"
                        value={account.role}
                        onChange={(event) => handleRoleChange(account, event.target.value as UserRole)}
                        disabled={!canEditRole}
                        sx={{ minWidth: 180 }}
                      >
                        {roleOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {ROLE_LABELS[option]}
                          </MenuItem>
                        ))}
                      </TextField>

                      <Button
                        variant="outlined"
                        onClick={() => handlePasswordChange(account)}
                        size="small"
                        disabled={!canEdit}
                      >
                        {account.password ? 'Update Password' : 'Set Password'}
                      </Button>

                      <Tooltip title={canEdit ? 'Rename user' : 'Insufficient permission'}>
                        <span>
                          <IconButton onClick={() => handleRename(account)} disabled={!canEdit}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title={disableRemoval ? 'Cannot remove this account' : 'Remove user'}>
                        <span>
                          <IconButton
                            color="error"
                            onClick={() => handleRemoveUser(account)}
                            disabled={disableRemoval}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  );
                })}

                {sortedUsers.length === 0 && (
                  <Typography color="text.secondary">No users found.</Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default UserSettingsPage;
