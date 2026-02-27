import { createTheme } from '@mui/material/styles';

// Create a theme instance.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3f51b5', // A classic Material Design indigo
    },
    secondary: {
      main: '#f50057', // A classic Material Design pink
    },
    background: {
      default: '#f4f5f7', // A light gray background
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
  },
  shape: {
    borderRadius: 8, // Default border radius for components
  },
  components: {
    MuiButton: {
        styleOverrides: {
            root: {
                textTransform: 'none', // More modern button text
                fontWeight: 600,
            }
        }
    }
  }
});

export default theme;
