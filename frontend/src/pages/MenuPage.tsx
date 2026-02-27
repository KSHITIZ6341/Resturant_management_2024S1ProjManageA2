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
import MenuItemModal from '../components/MenuItemModal';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api';
import type { MenuItemRecord } from '../types/models';

const MenuPage = () => {
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemRecord | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchMenuItems = () => {
    apiGet<MenuItemRecord[]>('/api/menu-items')
      .then((data) => {
        setMenuItems(
          data.map((entry) => ({
            id: String(entry.id || ''),
            name: entry.name,
            category: (entry.category || 'ENTREE').toUpperCase() as MenuItemRecord['category']
          }))
        );
      })
      .catch((error) => {
        setStatus({ type: 'error', message: error.message || 'Unable to load menu items.' });
      });
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const handleSave = async (item: MenuItemRecord) => {
    try {
      if (item.id) {
        await apiPut(`/api/menu-items/${item.id}`, item);
      } else {
        await apiPost('/api/menu-items', item);
      }
      setStatus({ type: 'success', message: 'Menu item saved.' });
      setSelectedItem(null);
      setIsModalOpen(false);
      fetchMenuItems();
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to save menu item.'
      });
    }
  };

  const handleDelete = async (itemId: string | undefined) => {
    if (!itemId || !window.confirm('Are you sure you want to delete this menu item?')) {
      return;
    }

    try {
      await apiDelete(`/api/menu-items/${itemId}`);
      setStatus({ type: 'success', message: 'Menu item deleted.' });
      fetchMenuItems();
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete menu item.'
      });
    }
  };

  const sortedMenuItems = useMemo(
    () =>
      [...menuItems].sort((a, b) => {
        if (a.category === b.category) {
          return a.name.localeCompare(b.name);
        }
        return a.category.localeCompare(b.category);
      }),
    [menuItems]
  );

  const getCategoryChipColor = (category: MenuItemRecord['category']) => {
    if (category === 'MAIN') {
      return 'success';
    }
    if (category === 'DESSERT') {
      return 'warning';
    }
    return 'info';
  };

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
            Menu Items
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedItem(null);
              setIsModalOpen(true);
            }}
          >
            Add Menu Item
          </Button>
        </Box>

        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedMenuItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Chip label={item.category} color={getCategoryChipColor(item.category)} size="small" />
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {item.name}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => {
                        setSelectedItem(item);
                        setIsModalOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(item.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {sortedMenuItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">No menu items created yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <MenuItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        item={selectedItem}
      />
    </Container>
  );
};

export default MenuPage;
