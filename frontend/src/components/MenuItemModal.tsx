import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, 
    ToggleButton, ToggleButtonGroup
} from '@mui/material';

// (Assuming MenuItem interface is defined elsewhere)
interface MenuItem { id?: string; category: string; name: string; }
interface MenuItemModalProps { isOpen: boolean; onClose: () => void; onSave: (item: MenuItem) => void; item: MenuItem | null; }

const MenuItemModal = ({ isOpen, onClose, onSave, item }: MenuItemModalProps) => {
  const [formData, setFormData] = useState<MenuItem>({ category: 'ENTREE', name: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (item) setFormData(item);
      else setFormData({ category: 'ENTREE', name: '' });
      setError(null);
    }
  }, [item, isOpen]);

  const handleCategoryChange = (event: React.MouseEvent<HTMLElement>, newCategory: string) => {
    if (newCategory !== null) {
      setFormData(prev => ({ ...prev, category: newCategory }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setError(null);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required.');
      return;
    }
    onSave({ ...formData, name: formData.name.trim() });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{item ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
            <ToggleButtonGroup
                value={formData.category}
                exclusive
                onChange={handleCategoryChange}
                fullWidth
                sx={{ mb: 2, mt: 1 }}
            >
                <ToggleButton value="ENTREE">Entree</ToggleButton>
                <ToggleButton value="MAIN">Main</ToggleButton>
                <ToggleButton value="DESSERT">Dessert</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              fullWidth
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={Boolean(error)}
              helperText={error ?? ''}
            />
        </DialogContent>
        <DialogActions sx={{ p: '16px 24px' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default MenuItemModal;
