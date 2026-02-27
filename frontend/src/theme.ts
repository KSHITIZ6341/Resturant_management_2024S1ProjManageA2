import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      dark: '#1d4ed8',
      light: '#60a5fa'
    },
    secondary: {
      main: '#a855f7'
    },
    background: {
      default: '#f3f5fb',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Sora", "DM Sans", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.01em'
    },
    button: {
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 12
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        size: 'small'
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: '#f8fafc',
            color: '#0f172a',
            fontWeight: 700
          }
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(37, 99, 235, 0.04)'
          }
        }
      }
    }
  }
});

export default theme;
