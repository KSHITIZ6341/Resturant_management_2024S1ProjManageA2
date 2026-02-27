import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CustomerModal from '../components/CustomerModal';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api';
import type { Customer } from '../types/models';

const CustomerPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchCustomers = () => {
    apiGet<Customer[]>('/api/customers')
      .then((data) => {
        setCustomers(data.map((entry) => ({ ...entry, id: String(entry.id || '') })));
      })
      .catch((error) => {
        setStatus({ type: 'error', message: error.message || 'Unable to load customers.' });
      });
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSave = async (customer: Customer) => {
    try {
      if (customer.id) {
        await apiPut(`/api/customers/${customer.id}`, customer);
      } else {
        await apiPost('/api/customers', customer);
      }
      setStatus({ type: 'success', message: 'Customer details saved.' });
      setIsModalOpen(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to save customer.'
      });
    }
  };

  const handleDelete = async (customerId: string | undefined) => {
    if (!customerId || !window.confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    try {
      await apiDelete(`/api/customers/${customerId}`);
      setStatus({ type: 'success', message: 'Customer deleted.' });
      fetchCustomers();
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete customer.'
      });
    }
  };

  const orderedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 2 }}>
        {status && (
          <Alert severity={status.type} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
            {status.message}
          </Alert>
        )}

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            mb: 2
          }}
        >
          <Typography variant="h4" component="h1">
            Customers
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedCustomer(null);
              setIsModalOpen(true);
            }}
          >
            Add Customer
          </Button>
        </Box>

        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Pricing</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderedCustomers.map((customer) => (
                <TableRow key={customer.id} hover>
                  <TableCell component="th" scope="row">
                    <Typography fontWeight={600}>{customer.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{customer.email || '-'}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {customer.phone || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" label={`Lunch: ${customer.price_lunch || 0}`} color="info" />
                      <Chip size="small" label={`Dinner: ${customer.price_dinner || 0}`} color="secondary" />
                      <Chip size="small" label={`Kids: ${customer.price_kids || 0}`} color="warning" />
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setIsModalOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(customer.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {orderedCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No customers available.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        customer={selectedCustomer}
      />
    </Container>
  );
};

export default CustomerPage;
