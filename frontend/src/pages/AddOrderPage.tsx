import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import {
  Alert,
  Box,
  Button,
  Container,
  MenuItem,
  Paper,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { apiGet, apiPost } from '../lib/api';
import type { Customer, MenuItemRecord, OrderLine } from '../types/models';

const STORAGE_KEY = 'restaurant-order-form';
const STEPS = ['Order Details', 'Menu Selection', 'Overview'];
const MENU_CATEGORIES: Array<MenuItemRecord['category']> = ['ENTREE', 'MAIN', 'DESSERT'];
const MENU_CATEGORY_LABELS: Record<MenuItemRecord['category'], string> = {
  ENTREE: 'Entree',
  MAIN: 'Mains',
  DESSERT: 'Desserts'
};

interface OrderFormData {
  customer_id: string;
  order_number: string;
  service_type: 'Lunch' | 'Dinner';
  adults: number;
  kids: number;
  arrival_time: Dayjs;
  order_date: Dayjs;
  order_data: Record<string, OrderLine>;
}

interface OrderCreateResult {
  message?: string;
  invoice_number?: string;
  error?: string;
}

function getInitialFormData(): OrderFormData {
  const fallback: OrderFormData = {
    customer_id: '',
    order_number: '',
    service_type: 'Lunch',
    adults: 1,
    kids: 0,
    arrival_time: dayjs(),
    order_date: dayjs(),
    order_data: {}
  };

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OrderFormData> & {
      order_date?: string;
      arrival_time?: string;
    };

    const orderDate = parsed.order_date ? dayjs(parsed.order_date) : fallback.order_date;
    const arrivalTime = parsed.arrival_time ? dayjs(parsed.arrival_time) : fallback.arrival_time;

    return {
      ...fallback,
      ...parsed,
      adults: Number(parsed.adults ?? fallback.adults),
      kids: Number(parsed.kids ?? fallback.kids),
      order_date: orderDate.isValid() ? orderDate : fallback.order_date,
      arrival_time: arrivalTime.isValid() ? arrivalTime : fallback.arrival_time
    };
  } catch {
    return fallback;
  }
}

const AddOrderPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [menuStep, setMenuStep] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([]);
  const [formData, setFormData] = useState<OrderFormData>(getInitialFormData);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const dataToStore = {
      ...formData,
      order_date: formData.order_date.toISOString(),
      arrival_time: formData.arrival_time.toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
  }, [formData]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiGet<Customer[]>('/api/customers'),
      apiGet<MenuItemRecord[]>('/api/menu-items')
    ])
      .then(([customerData, menuData]) => {
        if (cancelled) {
          return;
        }

        setCustomers(customerData.map((entry) => ({ ...entry, id: String(entry.id || '') })));
        setMenuItems(
          menuData.map((entry) => ({
            id: String(entry.id || ''),
            name: entry.name,
            category: (entry.category || 'ENTREE').toUpperCase() as MenuItemRecord['category']
          }))
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setFeedback({ type: 'error', message: error.message || 'Unable to load customers or menu items.' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const orderedItems = useMemo(
    () =>
      Object.entries(formData.order_data)
        .filter(([, value]) => value.quantity > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    [formData.order_data]
  );

  const totalPax = formData.adults + formData.kids;
  const selectedCustomer = customers.find((entry) => String(entry.id) === formData.customer_id);

  const groupedMenuItems = useMemo(() => {
    const groups: Record<MenuItemRecord['category'], MenuItemRecord[]> = {
      ENTREE: [],
      MAIN: [],
      DESSERT: []
    };
    menuItems.forEach((item) => {
      groups[item.category].push(item);
    });
    return groups;
  }, [menuItems]);

  const categoryTotals = useMemo(
    () =>
      MENU_CATEGORIES.reduce<Record<MenuItemRecord['category'], number>>(
        (accumulator, category) => {
          accumulator[category] = groupedMenuItems[category].reduce((sum, item) => {
            return sum + (formData.order_data[item.name]?.quantity ?? 0);
          }, 0);
          return accumulator;
        },
        { ENTREE: 0, MAIN: 0, DESSERT: 0 }
      ),
    [groupedMenuItems, formData.order_data]
  );

  const handleNumberChange = (name: 'adults' | 'kids', value: string) => {
    const parsed = Number(value);
    setFormData((previous) => ({
      ...previous,
      [name]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    }));
  };

  const handleMenuItemQuantityChange = (itemName: string, quantity: number) => {
    setFormData((previous) => ({
      ...previous,
      order_data: {
        ...previous.order_data,
        [itemName]: { quantity: Math.max(0, quantity) }
      }
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);

    if (!formData.customer_id) {
      setSaving(false);
      setFeedback({ type: 'error', message: 'Please select a customer before saving.' });
      return;
    }

    if (!formData.order_number.trim()) {
      setSaving(false);
      setFeedback({ type: 'error', message: 'Order number is required.' });
      return;
    }

    const submissionData = {
      ...formData,
      order_date: formData.order_date.format('YYYY-MM-DD'),
      arrival_time: formData.arrival_time.format('HH:mm'),
      order_data: Object.fromEntries(orderedItems)
    };

    try {
      const response = await apiPost<OrderCreateResult>('/api/orders', submissionData);
      localStorage.removeItem(STORAGE_KEY);
      setFeedback({
        type: 'success',
        message: response.message || 'Order created successfully.'
      });
      navigate('/orders');
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to save order. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const renderMenuStep = () => {
    const activeCategory = MENU_CATEGORIES[menuStep];

    return (
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        <Stepper nonLinear activeStep={menuStep}>
          {MENU_CATEGORIES.map((category, index) => (
            <Step key={category} completed={categoryTotals[category] > 0}>
              <StepButton onClick={() => setMenuStep(index)}>
                {MENU_CATEGORY_LABELS[category]}
                {categoryTotals[category] > 0 ? ` (${categoryTotals[category]})` : ''}
              </StepButton>
            </Step>
          ))}
        </Stepper>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 3,
            backgroundColor: 'rgba(255,255,255,0.92)'
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {MENU_CATEGORY_LABELS[activeCategory]}
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.2 }}>
            {groupedMenuItems[activeCategory].length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No items in this category.
              </Typography>
            )}
            {groupedMenuItems[activeCategory].map((item) => (
              <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Typography sx={{ flex: 1 }}>{item.name}</Typography>
                <TextField
                  type="number"
                  size="small"
                  inputProps={{ min: 0 }}
                  sx={{ width: 92 }}
                  value={formData.order_data[item.name]?.quantity ?? 0}
                  onChange={(event) =>
                    handleMenuItemQuantityChange(item.name, Number(event.target.value || 0))
                  }
                />
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    );
  };

  const handleBackClick = () => {
    if (step === 1 && menuStep > 0) {
      setMenuStep((value) => Math.max(0, value - 1));
      return;
    }
    setStep((value) => Math.max(0, value - 1));
  };

  const handleNextClick = () => {
    if (step === 1 && menuStep < MENU_CATEGORIES.length - 1) {
      setMenuStep((value) => Math.min(MENU_CATEGORIES.length - 1, value + 1));
      return;
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const backButtonLabel = step === 1 && menuStep > 0 ? 'Previous Category' : 'Back';
  const nextButtonLabel =
    step === 1 && menuStep < MENU_CATEGORIES.length - 1 ? 'Next Category' : 'Next';
  const nextButtonIcon = step === 1 && menuStep < MENU_CATEGORIES.length - 1 ? undefined : <FiChevronRight />;

  const renderOverviewStep = () => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Typography variant="h6" fontWeight={700}>
        Review Order
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" color="text.secondary">Customer</Typography>
          <Typography>{selectedCustomer?.name || 'Not selected'}</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" color="text.secondary">Order Number</Typography>
          <Typography>{formData.order_number || '-'}</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" color="text.secondary">Service</Typography>
          <Typography>{formData.service_type}</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body2" color="text.secondary">Date / Time</Typography>
          <Typography>
            {formData.order_date.format('YYYY-MM-DD')} at {formData.arrival_time.format('HH:mm')}
          </Typography>
        </Grid>
      </Grid>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell align="right">Quantity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orderedItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} align="center">
                No menu items selected.
              </TableCell>
            </TableRow>
          )}
          {orderedItems.map(([itemName, item]) => (
            <TableRow key={itemName}>
              <TableCell>{itemName}</TableCell>
              <TableCell align="right">{item.quantity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography variant="body1" fontWeight={600}>
        Total guests: {totalPax} ({formData.adults} adults, {formData.kids} kids)
      </Typography>
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 4,
          border: '1px solid rgba(15,23,42,0.08)',
          background: 'linear-gradient(180deg, rgba(250,252,255,0.95), rgba(247,250,252,0.95))'
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Order
        </Typography>
        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {feedback && (
          <Alert severity={feedback.type} sx={{ mb: 2 }}>
            {feedback.message}
          </Alert>
        )}

        <Paper
          variant="outlined"
          sx={{ p: { xs: 2, md: 3 }, minHeight: 360, borderRadius: 3, backgroundColor: '#fff' }}
        >
          {step === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Customer"
                  value={formData.customer_id}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, customer_id: event.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>Select a customer</em>
                  </MenuItem>
                  {customers.map((customer) => (
                    <MenuItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Order Number"
                  value={formData.order_number}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, order_number: event.target.value }))
                  }
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Order Date"
                  value={formData.order_date}
                  onChange={(value) =>
                    setFormData((previous) => ({
                      ...previous,
                      order_date: value && value.isValid() ? value : previous.order_date
                    }))
                  }
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TimePicker
                  label="Arrival Time"
                  value={formData.arrival_time}
                  minutesStep={15}
                  onChange={(value) =>
                    setFormData((previous) => ({
                      ...previous,
                      arrival_time: value && value.isValid() ? value : previous.arrival_time
                    }))
                  }
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Adults"
                  inputProps={{ min: 0 }}
                  value={formData.adults}
                  onChange={(event) => handleNumberChange('adults', event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Kids"
                  inputProps={{ min: 0 }}
                  value={formData.kids}
                  onChange={(event) => handleNumberChange('kids', event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  label="Service Type"
                  value={formData.service_type}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      service_type: event.target.value as OrderFormData['service_type']
                    }))
                  }
                >
                  <MenuItem value="Lunch">Lunch</MenuItem>
                  <MenuItem value="Dinner">Dinner</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          )}

          {step === 1 && renderMenuStep()}
          {step === 2 && renderOverviewStep()}
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Button disabled={step === 0} onClick={handleBackClick} startIcon={<FiChevronLeft />}>
            {backButtonLabel}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="contained" onClick={handleNextClick} endIcon={nextButtonIcon}>
              {nextButtonLabel}
            </Button>
          ) : (
            <Button variant="contained" color="success" onClick={handleSubmit} startIcon={<FiPlus />} disabled={saving}>
              {saving ? 'Saving...' : 'Save Order'}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default AddOrderPage;
