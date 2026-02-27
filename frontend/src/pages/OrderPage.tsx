import { useState, useEffect, useMemo, useCallback, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Backdrop,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Fade,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Modal,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  order_date: string;
  service_type: string;
  adults: number;
  kids: number;
  arrival_time?: string;
  order_data?: unknown;
}

const OrderPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionAnchorEl, setActionAnchorEl] = useState<HTMLElement | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [editForm, setEditForm] = useState<Order | null>(null);

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/orders')
      .then((response) => response.json())
      .then(setOrders)
      .catch((error) => {
        console.error('Failed to load orders:', error);
      });
  }, []);

  const customerOptions = useMemo(() => {
    const unique = new Set<string>();
    orders.forEach((order) => {
      if (order.customer_name) {
        unique.add(order.customer_name);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesText =
        !term ||
        [order.order_number, order.customer_name, order.service_type]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(term));

      const matchesCustomer =
        selectedCustomer === 'all' || order.customer_name === selectedCustomer;

      const orderDate = dayjs(order.order_date);
      const matchesDateFrom = !dateFrom || (orderDate.isValid() && orderDate.isSameOrAfter(dayjs(dateFrom), 'day'));
      const matchesDateTo = !dateTo || (orderDate.isValid() && orderDate.isSameOrBefore(dayjs(dateTo), 'day'));

      return matchesText && matchesCustomer && matchesDateFrom && matchesDateTo;
    });
  }, [orders, searchTerm, selectedCustomer, dateFrom, dateTo]);

  const openActionMenu = useCallback((order: Order, anchor: HTMLElement) => {
    setSelectedOrder(order);
    setActionAnchorEl(anchor);
  }, []);

  const closeActionMenu = useCallback(() => {
    setActionAnchorEl(null);
  }, []);

  const handleRowClick = useCallback(
    (order: Order) => (event: MouseEvent<HTMLElement>) => {
      openActionMenu(order, event.currentTarget);
    },
    [openActionMenu]
  );

  const viewOrder = useCallback((order: Order) => {
    setSelectedOrder(order);
    setEditForm(null);
    setModalMode('view');
    setViewModalOpen(true);
  }, []);

  const editOrder = useCallback((order: Order) => {
    setSelectedOrder(order);
    setEditForm({ ...order });
    setModalMode('edit');
    setViewModalOpen(true);
  }, []);

  const handleEditFieldChange = useCallback((field: keyof Order, value: string) => {
    setEditForm((previous) => {
      if (!previous) {
        return previous;
      }
      if (field === 'adults' || field === 'kids') {
        return { ...previous, [field]: Number(value) };
      }
      return { ...previous, [field]: value };
    });
  }, []);

  const saveEditedOrder = useCallback(async () => {
    if (!editForm) {
      return;
    }

    const payload = { ...editForm } as Record<string, unknown>;
    delete (payload as any).order_data;

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const updated = (await response.json().catch(() => null)) ?? editForm;
      setOrders((previous) =>
        previous.map((order) =>
          order.id === editForm.id ? { ...order, ...updated } : order
        )
      );
      setSelectedOrder({ ...editForm, ...updated });
      setModalMode('view');
      setViewModalOpen(false);
      setEditForm(null);
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Unable to update the order. Please try again.');
    }
  }, [editForm]);

  const deleteOrder = useCallback(async (order: Order) => {
    const confirmed = window.confirm(`Delete order ${order.order_number}?`);
    if (!confirmed) {
      return;
    }
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/orders/${order.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      setOrders((previous) => previous.filter((existing) => existing.id !== order.id));
      setSelectedOrder((current) => {
        if (current && current.id === order.id) {
          setViewModalOpen(false);
          return null;
        }
        return current;
      });
      setEditForm((current) => (current && current.id === order.id ? null : current));
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Unable to delete the order. Please try again.');
    }
  }, []);

  const closeViewModal = useCallback(() => {
    setViewModalOpen(false);
    setSelectedOrder(null);
    setEditForm(null);
    setModalMode('view');
  }, []);

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 2 }}>
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
            Orders
          </Typography>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ width: '100%' }}
            alignItems={{ md: 'center' }}
            flexWrap={{ md: 'wrap' }}
          >
            <TextField
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              size="small"
              placeholder="Search orders"
              sx={{ minWidth: { xs: '100%', sm: 220 }, flexBasis: { md: 220 }, flexGrow: { md: 0 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <TextField
              select
              size="small"
              label="Customer"
              value={selectedCustomer}
              onChange={(event) => setSelectedCustomer(event.target.value)}
              sx={{ minWidth: { xs: '100%', sm: 200 }, flexBasis: { md: 200 } }}
            >
              <MenuItem value="all">All customers</MenuItem>
              {customerOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="From date"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: '100%', sm: 160 }, flexBasis: { md: 160 } }}
            />
            <TextField
              size="small"
              label="To date"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: '100%', sm: 160 }, flexBasis: { md: 160 } }}
            />
            <Button
              component={Link}
              to="/orders/new"
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ alignSelf: { xs: 'stretch', md: 'auto' }, flexBasis: { md: 'auto' } }}
            >
              Add Order
            </Button>
          </Stack>
        </Box>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Pax</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} hover sx={{ cursor: 'pointer' }} onClick={handleRowClick(order)}>
                  <TableCell component="th" scope="row">{order.order_number}</TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell>{order.order_date}</TableCell>
                  <TableCell>
                    <Chip
                      label={order.service_type}
                      color={order.service_type === 'Lunch' ? 'info' : 'secondary'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{order.adults} Adults, {order.kids} Kids</TableCell>
                  <TableCell align="right" sx={{ minWidth: 160 }}>
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        viewOrder(order);
                        closeActionMenu();
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        editOrder(order);
                        closeActionMenu();
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={async (event) => {
                        event.stopPropagation();
                        await deleteOrder(order);
                        closeActionMenu();
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      No orders match your filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Menu
        anchorEl={actionAnchorEl}
        open={Boolean(actionAnchorEl)}
        onClose={closeActionMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            if (selectedOrder) {
              viewOrder(selectedOrder);
            }
            closeActionMenu();
          }}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedOrder) {
              editOrder(selectedOrder);
            }
            closeActionMenu();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            if (selectedOrder) {
              await deleteOrder(selectedOrder);
            }
            closeActionMenu();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Modal
        open={viewModalOpen && Boolean(selectedOrder)}
        onClose={closeViewModal}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{ backdrop: { timeout: 400 } }}
      >
        <Fade in={viewModalOpen && Boolean(selectedOrder)}>
          <Paper
            elevation={6}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: { xs: '90%', sm: 420 },
              p: 4,
              outline: 'none'
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>
                {modalMode === 'edit' ? 'Edit Order' : 'Order Details'}
              </Typography>
              <Divider />
              {modalMode === 'view' && selectedOrder && (
                <Stack spacing={1.5}>
                  <Typography variant="body2"><strong>Order #:</strong> {selectedOrder.order_number}</Typography>
                  <Typography variant="body2"><strong>Customer:</strong> {selectedOrder.customer_name}</Typography>
                  <Typography variant="body2"><strong>Date:</strong> {selectedOrder.order_date}</Typography>
                  <Typography variant="body2"><strong>Arrival:</strong> {selectedOrder.arrival_time ?? 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Service:</strong> {selectedOrder.service_type}</Typography>
                  <Typography variant="body2"><strong>Guests:</strong> {selectedOrder.adults} Adults, {selectedOrder.kids} Kids</Typography>
                </Stack>
              )}
              {modalMode === 'edit' && editForm && (
                <Stack spacing={1.5}>
                  <TextField
                    label="Order #"
                    value={editForm.order_number}
                    onChange={(event) => handleEditFieldChange('order_number', event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Customer"
                    value={editForm.customer_name}
                    onChange={(event) => handleEditFieldChange('customer_name', event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Date"
                    type="date"
                    value={editForm.order_date ?? ''}
                    onChange={(event) => handleEditFieldChange('order_date', event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="Arrival Time"
                    type="time"
                    value={editForm.arrival_time ?? ''}
                    onChange={(event) => handleEditFieldChange('arrival_time', event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Service Type"
                    value={editForm.service_type}
                    onChange={(event) => handleEditFieldChange('service_type', event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="Lunch">Lunch</MenuItem>
                    <MenuItem value="Dinner">Dinner</MenuItem>
                  </TextField>
                  <TextField
                    label="Adults"
                    type="number"
                    inputProps={{ min: 0 }}
                    value={editForm.adults}
                    onChange={(event) => handleEditFieldChange('adults', event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Kids"
                    type="number"
                    inputProps={{ min: 0 }}
                    value={editForm.kids}
                    onChange={(event) => handleEditFieldChange('kids', event.target.value)}
                    fullWidth
                  />
                </Stack>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                <Button variant="outlined" onClick={closeViewModal}>
                  {modalMode === 'edit' ? 'Cancel' : 'Close'}
                </Button>
                {modalMode === 'view' && selectedOrder && (
                  <Button
                    variant="contained"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={() => {
                      editOrder(selectedOrder);
                    }}
                  >
                    Edit
                  </Button>
                )}
                {modalMode === 'edit' && editForm && (
                  <Button variant="contained" color="success" onClick={saveEditedOrder}>
                    Save changes
                  </Button>
                )}
              </Box>
            </Stack>
          </Paper>
        </Fade>
      </Modal>
    </Container>
  );
};

export default OrderPage;










