import { useState, useEffect } from 'react';
import MenuItemModal from '../components/MenuItemModal';
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  IconButton,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface MenuItemDto {
  id: string;
  category: string;
  name: string;
}

const MENU_ENDPOINT = 'http://127.0.0.1:5000/api/menu-items';

const MenuPage = () => {
  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemDto | null>(null);

  const fetchMenuItems = () => {
    fetch(MENU_ENDPOINT)
      .then((response) => response.json())
      .then((data) => setMenuItems(data.map((entry: any) => ({ ...entry, id: String(entry.id) }))))
      .catch((error) => {
        console.error('Failed to load menu items:', error);
      });
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const handleSave = (item: MenuItemDto) => {
    const payload: any = { ...item };
    if (!payload.id) {
      delete payload.id;
    }

    const method = payload.id ? 'PUT' : 'POST';
    const endpoint = payload.id ? `${MENU_ENDPOINT}/${payload.id}` : MENU_ENDPOINT;

    fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }
        fetchMenuItems();
        setSelectedItem(null);
        setIsModalOpen(false);
      })
      .catch((error) => {
        console.error('Unable to save menu item:', error);
        alert('Unable to save menu item. Please try again.');
      });
  };

  const handleDelete = (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) {
      return;
    }

    fetch(`${MENU_ENDPOINT}/${itemId}`, { method: 'DELETE' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }
        fetchMenuItems();
      })
      .catch((error) => {
        console.error('Unable to delete menu item:', error);
        alert('Unable to delete menu item. Please try again.');
      });
  };

  const getCategoryChipColor = (category: string) => {
    switch (category) {
      case 'ENTREE':
        return 'primary';
      case 'MAIN':
        return 'success';
      case 'DESSERT':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
              {menuItems.map((item) => (
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
              {menuItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No menu items created yet.
                    </Typography>
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

