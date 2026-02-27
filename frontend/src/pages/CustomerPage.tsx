import { useState, useEffect } from 'react';
import CustomerModal from '../components/CustomerModal';
import {
    Container, Paper, Typography, Button, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Box, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// (Assuming Customer interface is defined elsewhere)
interface Customer { id: number; name: string; email: string; price_lunch: number; price_dinner: number; price_kids: number; phone: string; address: string; additional_info: string; }

const CustomerPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const fetchCustomers = () => {
    fetch('http://127.0.0.1:5000/api/customers').then(res => res.json()).then(setCustomers);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleSave = (customer: Customer) => {
    const method = customer.id ? 'PUT' : 'POST';
    const url = customer.id ? `http://127.0.0.1:5000/api/customers/${customer.id}` : 'http://127.0.0.1:5000/api/customers';
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customer) })
      .then(() => { fetchCustomers(); setIsModalOpen(false); });
  };

  const handleDelete = (customerId: number) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      fetch(`http://127.0.0.1:5000/api/customers/${customerId}`, { method: 'DELETE' }).then(() => fetchCustomers());
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">Customers</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setSelectedCustomer(null); setIsModalOpen(true); }}>
            Add Customer
          </Button>
        </Box>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Prices</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id} hover>
                  <TableCell component="th" scope="row">{customer.name}</TableCell>
                  <TableCell>{customer.email}<br/>{customer.phone}</TableCell>
                  <TableCell>L:{customer.price_lunch} D:{customer.price_dinner} K:{customer.price_kids}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => { setSelectedCustomer(customer); setIsModalOpen(true); }}><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(customer.id)} color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <CustomerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} customer={selectedCustomer} />
    </Container>
  );
};

export default CustomerPage;
