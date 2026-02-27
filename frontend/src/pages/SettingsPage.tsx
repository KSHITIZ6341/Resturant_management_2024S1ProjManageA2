import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Container,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import Grid from '@mui/material/Grid';

const DEFAULT_SETTINGS = {
  email_subject_template: '',
  email_body_template: '',
  smtp_server: '',
  smtp_port: '587',
  smtp_encryption: 'STARTTLS',
  smtp_authentication: true,
  smtp_username: '',
  smtp_password: '',
  imap_server: '',
  imap_port: '993',
  imap_encryption: 'SSL/TLS',
  imap_authentication: true,
  imap_username: '',
  imap_password: ''
};

const SMTP_PORT_OPTIONS = [
  { label: '465 (SSL/TLS)', value: '465' },
  { label: '587 (STARTTLS)', value: '587' }
];

const IMAP_PORT_OPTIONS = [
  { label: '993 (SSL/TLS)', value: '993' },
  { label: '143 (STARTTLS)', value: '143' }
];

const ENCRYPTION_OPTIONS = [
  { label: 'SSL/TLS (Implicit TLS)', value: 'SSL/TLS' },
  { label: 'STARTTLS', value: 'STARTTLS' },
  { label: 'None', value: 'None' }
];

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' | '' }>({ message: '', type: '' });

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (!data) {
          return;
        }

        setSettings((prev) => ({
          ...prev,
          ...data,
          smtp_port: data.smtp_port !== undefined ? String(data.smtp_port) : prev.smtp_port,
          imap_port: data.imap_port !== undefined ? String(data.imap_port) : prev.imap_port,
          smtp_authentication:
            data.smtp_authentication !== undefined
              ? data.smtp_authentication === true || data.smtp_authentication === 'true'
              : prev.smtp_authentication,
          imap_authentication:
            data.imap_authentication !== undefined
              ? data.imap_authentication === true || data.imap_authentication === 'true'
              : prev.imap_authentication
        }));
      })
      .catch(() => setStatus({ message: 'Failed to load settings', type: 'error' }));
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: 'smtp_authentication' | 'imap_authentication') =>
    (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setSettings((prev) => ({ ...prev, [name]: checked }));
    };

  const handleSave = () => {
    setStatus({ message: '', type: '' });

    fetch('http://127.0.0.1:5000/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Request failed');
        }
        return res.json();
      })
      .then(() => {
        setStatus({ message: 'Settings saved successfully!', type: 'success' });
      })
      .catch(() => setStatus({ message: 'Failed to save settings', type: 'error' }));
  };

  const renderMailCard = (
    title: string,
    description: string,
    prefix: 'smtp' | 'imap',
    portOptions: { label: string; value: string }[]
  ) => {
    const serverName = `${prefix}_server` as const;
    const portName = `${prefix}_port` as const;
    const encryptionName = `${prefix}_encryption` as const;
    const authName = `${prefix}_authentication` as const;
    const usernameName = `${prefix}_username` as const;
    const passwordName = `${prefix}_password` as const;

    const isAuthEnabled = Boolean(settings[authName]);

    return (
      <Card sx={{ height: '100%' }}>
        <CardHeader title={title} subheader={description} />
        <CardContent>
          <Stack spacing={2.5}>
            <TextField
              label="Server Hostname"
              name={serverName}
              value={settings[serverName]}
              onChange={handleChange}
              placeholder={prefix === 'smtp' ? 'smtp.yourservice.com' : 'imap.yourservice.com'}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Port"
                  name={portName}
                  value={settings[portName]}
                  onChange={handleChange}
                  fullWidth
                  helperText={
                    prefix === 'smtp'
                      ? 'Recommended: 465 for SSL/TLS or 587 with STARTTLS'
                      : 'Recommended: 993 for SSL/TLS or 143 with STARTTLS'
                  }
                >
                  {portOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Encryption"
                  name={encryptionName}
                  value={settings[encryptionName]}
                  onChange={handleChange}
                  fullWidth
                >
                  {ENCRYPTION_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <FormControlLabel
              control={<Switch checked={isAuthEnabled} onChange={handleSwitchChange(authName)} />}
              label="Authentication required"
            />
            {isAuthEnabled && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Username"
                    name={usernameName}
                    value={settings[usernameName]}
                    onChange={handleChange}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    type="password"
                    label="Password"
                    name={passwordName}
                    value={settings[passwordName]}
                    onChange={handleChange}
                    fullWidth
                  />
                </Grid>
              </Grid>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Email Settings
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Configure the invoice email template and the connection details for your mail service.
          </Typography>
        </Box>

        <Card>
          <CardHeader title="Invoice Email Template" subheader="Define the default messaging used when invoices are sent." />
          <CardContent>
            <Stack spacing={2.5}>
              <TextField
                label="Email Subject"
                name="email_subject_template"
                value={settings.email_subject_template}
                onChange={handleChange}
                helperText="Placeholders such as [order number] and [customer name] are supported."
                fullWidth
              />
              <TextField
                label="Email Body"
                name="email_body_template"
                value={settings.email_body_template}
                onChange={handleChange}
                helperText="Supports placeholders like [order number], [customer name], or [invoice link]."
                fullWidth
                multiline
                minRows={5}
              />
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderMailCard(
              'Outbound Mail (SMTP)',
              'Credentials used for sending invoices through your mail provider.',
              'smtp',
              SMTP_PORT_OPTIONS
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderMailCard(
              'Inbound Mail (IMAP)',
              'Mailbox details used for syncing or tracking replies.',
              'imap',
              IMAP_PORT_OPTIONS
            )}
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleSave}>
            Save Settings
          </Button>
        </Box>

        {status.message && (
          <Alert severity={status.type || 'info'}>{status.message}</Alert>
        )}
      </Stack>
    </Container>
  );
};

export default SettingsPage;

