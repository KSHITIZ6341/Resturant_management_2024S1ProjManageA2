import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Container,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { apiGet, apiPut } from '../lib/api';

interface SettingsFormState {
  sender_email: string;
  google_app_password: string;
  email_subject_template: string;
  email_body_template: string;
}

const DEFAULT_SETTINGS: SettingsFormState = {
  sender_email: '',
  google_app_password: '',
  email_subject_template: '',
  email_body_template: ''
};

const SettingsPage = () => {
  const [settings, setSettings] = useState<SettingsFormState>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' | '' }>({ message: '', type: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<Partial<SettingsFormState>>('/api/settings')
      .then((data) => {
        if (!data) {
          return;
        }
        setSettings((previous) => ({ ...previous, ...data }));
      })
      .catch((error) => {
        setStatus({ message: error.message || 'Failed to load settings.', type: 'error' });
      });
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setSettings((previous) => ({ ...previous, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus({ message: '', type: '' });

    try {
      await apiPut('/api/settings', settings);
      setStatus({ message: 'Settings saved successfully.', type: 'success' });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : 'Failed to save settings.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Email Settings
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Configure the sender account and default email template used when invoices are sent.
          </Typography>
        </Box>

        {status.message && (
          <Alert severity={status.type || 'info'} onClose={() => setStatus({ message: '', type: '' })}>
            {status.message}
          </Alert>
        )}

        <Card>
          <CardHeader title="Delivery Account" subheader="These credentials are used to send order emails." />
          <CardContent>
            <Stack spacing={2.5}>
              <TextField
                label="Sender Email"
                name="sender_email"
                value={settings.sender_email}
                onChange={handleChange}
                type="email"
                autoComplete="email"
                fullWidth
              />
              <TextField
                label="Google App Password"
                name="google_app_password"
                value={settings.google_app_password}
                onChange={handleChange}
                type="password"
                autoComplete="new-password"
                fullWidth
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Message Template" subheader="Use placeholders such as [order number] and [customer name]." />
          <CardContent>
            <Stack spacing={2.5}>
              <TextField
                label="Email Subject"
                name="email_subject_template"
                value={settings.email_subject_template}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Email Body"
                name="email_body_template"
                value={settings.email_body_template}
                onChange={handleChange}
                minRows={5}
                multiline
                fullWidth
              />
            </Stack>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Stack>
    </Container>
  );
};

export default SettingsPage;
