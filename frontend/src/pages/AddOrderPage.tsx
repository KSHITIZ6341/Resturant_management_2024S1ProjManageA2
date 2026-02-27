import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import {
    Container, Stepper, Step, StepLabel, Button, Paper, Typography, 
    TextField, MenuItem, Box
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';

const STORAGE_KEY = 'restaurant-order-form';

// --- Robust function to get initial form data ---
const getInitialFormData = () => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    try {
        if (savedData) {
            const parsed = JSON.parse(savedData);
            const orderDate = parsed.order_date ? dayjs(parsed.order_date) : dayjs();
            const arrivalTime = parsed.arrival_time ? dayjs(parsed.arrival_time) : dayjs();

            return {
                ...parsed,
                order_date: orderDate.isValid() ? orderDate : dayjs(),
                arrival_time: arrivalTime.isValid() ? arrivalTime : dayjs(),
            };
        }
    } catch (error) {
        // If parsing fails, return default
        console.error("Failed to parse saved form data:", error);
    }
    // Default state
    return {
        customer_id: '', order_number: '', service_type: 'Lunch', adults: 1, kids: 0,
        arrival_time: dayjs(),
        order_date: dayjs(),
        order_data: {}
    };
};

const AddOrderPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [formData, setFormData] = useState(getInitialFormData);

  // --- Effect to save to localStorage ---
  useEffect(() => {
    try {
        const dataToStore = {
            ...formData,
            order_date: formData.order_date && formData.order_date.isValid() ? formData.order_date.toISOString() : null,
            arrival_time: formData.arrival_time && formData.arrival_time.isValid() ? formData.arrival_time.toISOString() : null,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) {
        console.error("Could not save form data to localStorage:", error);
    }
  }, [formData]);

  // --- Effect to fetch initial data ---
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/customers').then(res => res.json()).then(setCustomers);
    fetch('http://127.0.0.1:5000/api/menu-items').then(res => res.json()).then(setMenuItems);
  }, []);

  // --- Handlers ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (newValue: Dayjs | null) => {
    setFormData(prev => ({ ...prev, order_date: newValue }));
  };

  const handleTimeChange = (newValue: Dayjs | null) => {
    setFormData(prev => ({ ...prev, arrival_time: newValue }));
  };

  const handleMenuItemQuantityChange = (itemName, quantity) => {
    setFormData(prev => ({ ...prev, order_data: { ...prev.order_data, [itemName]: { quantity: Math.max(0, quantity) } } }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalOrderData = Object.fromEntries(Object.entries(formData.order_data).filter(([, v]) => v.quantity > 0));
    const submissionData = {
        ...formData,
        order_date: formData.order_date ? formData.order_date.format('YYYY-MM-DD') : null,
        arrival_time: formData.arrival_time ? formData.arrival_time.format('HH:mm') : null,
        order_data: finalOrderData 
    };

    fetch('http://127.0.0.1:5000/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submissionData) })
      .then(() => {
        alert('Order created successfully!');
        localStorage.removeItem(STORAGE_KEY);
        navigate('/orders');
      })
      .catch(err => console.error("Failed to create order", err));
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 2));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const steps = ['Order Details', 'Menu Selection', 'Overview'];

  // --- Render Methods ---
  const renderMenuItems = (category) => (
    <Box key={category} mb={4}>
        <Typography variant="h6" gutterBottom>{category}</Typography>
        {menuItems.filter(item => item.category === category).map(item => (
            <Grid container spacing={2} alignItems="center" key={item.id} sx={{ mb: 1 }}>
                <Grid item xs={6}><Typography>{item.name}</Typography></Grid>
                <Grid item xs={6}><TextField type="number" size="small" value={formData.order_data[item.name]?.quantity || 0} onChange={(e) => handleMenuItemQuantityChange(item.name, parseInt(e.target.value, 10))} /></Grid>
            </Grid>
        ))}
    </Box>
  );

  const getStepContent = (stepIndex) => {
    switch (stepIndex) {
      case 0:
        return (
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6}><TextField select fullWidth label="Customer" name="customer_id" value={formData.customer_id} onChange={handleInputChange} sx={{ minWidth: 240 }}><MenuItem value=""><em>Select a Customer</em></MenuItem>{customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Order Number" name="order_number" value={formData.order_number} onChange={handleInputChange} /></Grid>
                <Grid item xs={12} sm={6}><DatePicker label="Date" value={formData.order_date} onChange={handleDateChange} /></Grid>
                <Grid item xs={12} sm={6}><TimePicker label="Arrival Time" value={formData.arrival_time} onChange={handleTimeChange} minutesStep={15} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Adults" type="number" name="adults" value={formData.adults} onChange={handleInputChange} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Kids" type="number" name="kids" value={formData.kids} onChange={handleInputChange} /></Grid>
                <Grid item xs={12}><TextField select fullWidth label="Service Type" name="service_type" value={formData.service_type} onChange={handleInputChange} sx={{ minWidth: 240 }}><MenuItem value="Lunch">Lunch</MenuItem><MenuItem value="Dinner">Dinner</MenuItem></TextField></Grid>
            </Grid>
        );
      case 1:
        return <div>{['ENTREE', 'MAIN', 'DESSERT'].map(cat => renderMenuItems(cat))}</div>;
      case 2:
        return <Typography>Overview coming soon...</Typography>;
      default:
        return 'Unknown step';
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>Create New Order</Typography>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
            {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>
        <Paper elevation={2} sx={{ p: { xs: 2, sm: 4 }, minHeight: '400px' }}>
            {getStepContent(step)}
        </Paper>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button disabled={step === 0} onClick={prevStep} startIcon={<FiChevronLeft />}>Back</Button>
            {step < steps.length - 1 ? (
                <Button variant="contained" onClick={nextStep} endIcon={<FiChevronRight />}>Next</Button>
            ) : (
                <Button variant="contained" color="success" onClick={handleSubmit} startIcon={<FiPlus />}>Save Order</Button>
            )}
        </Box>
    </Container>
  );
};

export default AddOrderPage;
