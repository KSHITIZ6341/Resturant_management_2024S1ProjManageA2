import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField
} from '@mui/material';
import Grid from '@mui/material/Grid';

// (Assuming Customer interface is defined elsewhere)
interface Customer { id?: number; name: string; email: string; price_lunch: number; price_dinner: number; price_kids: number; phone: string; address: string; additional_info: string; }
interface CustomerModalProps { isOpen: boolean; onClose: () => void; onSave: (customer: Customer) => void; customer: Customer | null; }

const CustomerModal = ({ isOpen, onClose, onSave, customer }: CustomerModalProps) => {
  const [formData, setFormData] = useState<Customer>({ name: '', email: '', price_lunch: 0, price_dinner: 0, price_kids: 0, phone: '', address: '', additional_info: '' });

  useEffect(() => {
    if (isOpen) {
      if (customer) setFormData(customer);
      else setFormData({ name: '', email: '', price_lunch: 0, price_dinner: 0, price_kids: 0, phone: '', address: '', additional_info: '' });
    }
  }, [customer, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{customer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}><TextField fullWidth label="Name" name="name" value={formData.name} onChange={handleChange} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Email" name="email" value={formData.email} onChange={handleChange} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth label="Price (Lunch)" type="number" name="price_lunch" value={formData.price_lunch} onChange={handleChange} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth label="Price (Dinner)" type="number" name="price_dinner" value={formData.price_dinner} onChange={handleChange} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth label="Price (Kids)" type="number" name="price_kids" value={formData.price_kids} onChange={handleChange} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Phone" name="phone" value={formData.phone} onChange={handleChange} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Address" name="address" value={formData.address} onChange={handleChange} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Additional Info" name="additional_info" value={formData.additional_info} onChange={handleChange} multiline rows={3} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: '16px 24px' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CustomerModal;
