import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { alpha, useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import dayjs, { Dayjs } from 'dayjs';
import { apiGet } from '../lib/api';

interface BookingEntry {
  id: string;
  customer: string;
  date: string;
  time?: string;
  partySize: number;
  serviceType?: string;
}

interface OrderApiResponse {
  id: number;
  customer_name?: string;
  order_date: string;
  arrival_time?: string;
  service_type?: string;
  adults?: number;
  kids?: number;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getServicePalette = (serviceType?: string) => {
  const normalized = (serviceType ?? '').toLowerCase();
  if (normalized.includes('dinner')) {
    return {
      label: 'Dinner',
      accent: '#d36b57',
      background: '#ffece6'
    };
  }
  if (normalized.includes('lunch')) {
    return {
      label: 'Lunch',
      accent: '#3f7ad8',
      background: '#e9f1ff'
    };
  }
  if (normalized.includes('kids')) {
    return {
      label: 'Kids',
      accent: '#3f9a77',
      background: '#e8f8ef'
    };
  }
  return {
    label: 'General',
    accent: '#6e62d3',
    background: '#efedff'
  };
};

const sortBookings = (a: BookingEntry, b: BookingEntry) => {
  const aTime = a.time ? dayjs(`${a.date} ${a.time}`) : dayjs(`${a.date} 23:59:59`);
  const bTime = b.time ? dayjs(`${b.date} ${b.time}`) : dayjs(`${b.date} 23:59:59`);
  return aTime.valueOf() - bTime.valueOf();
};

const ManagementDashboardPage: React.FC = () => {
  const theme = useTheme();
  const today = useMemo(() => dayjs().startOf('day'), []);
  const [orders, setOrders] = useState<OrderApiResponse[]>([]);
  const [viewMonthStart, setViewMonthStart] = useState<Dayjs>(today.startOf('month'));
  const [selectedDate, setSelectedDate] = useState<Dayjs>(today);

  useEffect(() => {
    apiGet<OrderApiResponse[]>('/api/orders')
      .then((data) => {
        setOrders(data);
      })
      .catch((error) => {
        console.error('Unable to load orders for dashboard calendar:', error);
      });
  }, []);

  const bookings = useMemo<BookingEntry[]>(
    () =>
      orders
        .filter((order) => Boolean(order.order_date))
        .map((order) => {
          const adults = order.adults ?? 0;
          const kids = order.kids ?? 0;
          const partySize = adults + kids;
          return {
            id: `order-${order.id}`,
            customer: order.customer_name ?? 'Guest',
            date: dayjs(order.order_date).format('YYYY-MM-DD'),
            time: order.arrival_time ?? undefined,
            partySize: partySize > 0 ? partySize : 1,
            serviceType: order.service_type
          };
        })
        .sort(sortBookings),
    [orders]
  );

  const bookingsByDate = useMemo<Record<string, BookingEntry[]>>(() => {
    const grouped: Record<string, BookingEntry[]> = {};
    bookings.forEach((booking) => {
      if (!grouped[booking.date]) {
        grouped[booking.date] = [];
      }
      grouped[booking.date].push(booking);
    });
    Object.keys(grouped).forEach((dateKey) => grouped[dateKey].sort(sortBookings));
    return grouped;
  }, [bookings]);

  const monthBookings = useMemo(
    () => bookings.filter((booking) => dayjs(booking.date).isSame(viewMonthStart, 'month')),
    [bookings, viewMonthStart]
  );

  const totalBookings = monthBookings.length;

  const monthlyGuestCount = useMemo(
    () => monthBookings.reduce((sum, booking) => sum + booking.partySize, 0),
    [monthBookings]
  );

  const upcomingTimeline = useMemo(
    () =>
      bookings
        .filter((booking) => {
          const date = dayjs(booking.date);
          return date.isSame(today, 'day') || date.isAfter(today, 'day');
        })
        .slice(0, 12),
    [bookings, today]
  );

  const bookingDensity = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;
    monthBookings.forEach((booking) => {
      const count = (map.get(booking.date) ?? 0) + 1;
      map.set(booking.date, count);
      max = Math.max(max, count);
    });
    return { map, max };
  }, [monthBookings]);

  const calendarCells = useMemo(() => {
    const daysInMonth = viewMonthStart.daysInMonth();
    const leading = viewMonthStart.day();
    const dates = Array.from({ length: daysInMonth }, (_, index) => viewMonthStart.add(index, 'day'));
    const trailing = (7 - ((leading + dates.length) % 7)) % 7;
    const emptyBefore = Array.from({ length: leading }, () => null);
    const emptyAfter = Array.from({ length: trailing }, () => null);
    return [...emptyBefore, ...dates, ...emptyAfter];
  }, [viewMonthStart]);

  const selectedDateKey = selectedDate.format('YYYY-MM-DD');
  const selectedBookings = useMemo(() => bookingsByDate[selectedDateKey] ?? [], [bookingsByDate, selectedDateKey]);

  const formatBookingTime = useCallback((date: string, time?: string) => {
    if (!time) {
      return 'Time TBD';
    }
    const parsed = dayjs(`${date} ${time}`);
    return parsed.isValid() ? parsed.format('h:mm A') : time;
  }, []);

  const changeMonth = useCallback((offset: number) => {
    setViewMonthStart((previous) => {
      const next = previous.add(offset, 'month');
      setSelectedDate((current) => {
        if (current.isSame(next, 'month')) {
          return current;
        }
        const clampedDay = Math.min(current.date(), next.daysInMonth());
        return next.date(clampedDay).startOf('day');
      });
      return next;
    });
  }, []);

  const goToPreviousMonth = useCallback(() => changeMonth(-1), [changeMonth]);
  const goToNextMonth = useCallback(() => changeMonth(1), [changeMonth]);

  const jumpToToday = useCallback(() => {
    setViewMonthStart(today.startOf('month'));
    setSelectedDate(today);
  }, [today]);

  const handleSelectDate = useCallback(
    (day: Dayjs) => {
      if (!day.isSame(viewMonthStart, 'month')) {
        return;
      }
      setSelectedDate(day.startOf('day'));
    },
    [viewMonthStart]
  );

  useEffect(() => {
    if (!selectedDate.isSame(viewMonthStart, 'month')) {
      setSelectedDate(viewMonthStart);
    }
  }, [selectedDate, viewMonthStart]);

  const renderCalendarDay = useCallback(
    (day: Dayjs | null, index: number) => {
      if (!day) {
        return (
          <Box
            key={`blank-${index}`}
            sx={{
              minHeight: { xs: 98, md: 112 },
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.divider, 0.22)}`,
              backgroundColor: alpha(theme.palette.background.default, 0.2)
            }}
          />
        );
      }

      if (!day.isSame(viewMonthStart, 'month')) {
        return (
          <Box
            key={day.format('YYYY-MM-DD')}
            sx={{
              minHeight: { xs: 98, md: 112 },
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              backgroundColor: alpha(theme.palette.background.default, 0.16)
            }}
          />
        );
      }

      const dateKey = day.format('YYYY-MM-DD');
      const bookingsForDay = bookingsByDate[dateKey] ?? [];
      const count = bookingDensity.map.get(dateKey) ?? 0;
      const isToday = day.isSame(today, 'day');
      const isSelected = day.isSame(selectedDate, 'day');
      const preview = bookingsForDay.slice(0, 2);
      const density = bookingDensity.max > 0 ? count / bookingDensity.max : 0;

      return (
        <Box
          key={dateKey}
          role="gridcell"
          aria-selected={isSelected}
          onClick={() => handleSelectDate(day)}
          sx={{
            cursor: 'pointer',
            minHeight: { xs: 98, md: 112 },
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 0.95,
            border: `1px solid ${
              isSelected
                ? alpha('#71839f', 0.8)
                : isToday
                  ? alpha('#8ba2bf', 0.7)
                  : alpha(theme.palette.divider, 0.32)
            }`,
            background: isSelected
              ? `linear-gradient(160deg, ${alpha('#f0f4fa', 0.96)} 0%, ${alpha('#e9eef6', 0.96)} 100%)`
              : alpha(theme.palette.background.paper, 0.95),
            boxShadow: isSelected
              ? `0 8px 18px ${alpha('#6d809a', 0.18)}`
              : `0 3px 10px ${alpha('#64748b', 0.08)}`,
            transition: 'all 170ms ease',
            '&:hover': {
              borderColor: alpha('#7c8fa9', 0.72),
              boxShadow: `0 10px 20px ${alpha('#6d809a', 0.14)}`
            }
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography
              variant="caption"
              sx={{
                fontWeight: 800,
                color: isToday ? '#627c99' : theme.palette.text.primary
              }}
            >
              {day.date()}
            </Typography>
            {count > 0 && (
              <Chip
                size="small"
                label={count}
                sx={{
                  height: 19,
                  borderRadius: 1.2,
                  fontWeight: 700,
                  fontSize: '0.66rem',
                  color: '#5c708d',
                  backgroundColor: alpha('#94a7c1', 0.18 + density * 0.2),
                  border: `1px solid ${alpha('#8ea3bf', 0.36)}`
                }}
              />
            )}
          </Stack>

          <Stack spacing={0.45}>
            {preview.map((booking) => {
              const servicePalette = getServicePalette(booking.serviceType);
              return (
                <Box
                  key={booking.id}
                  sx={{
                    borderRadius: 1.2,
                    borderLeft: `3px solid ${servicePalette.accent}`,
                    backgroundColor: servicePalette.background,
                    px: 0.6,
                    py: 0.35
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      fontWeight: 700,
                      lineHeight: 1.14,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {formatBookingTime(booking.date, booking.time)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {booking.customer}
                  </Typography>
                </Box>
              );
            })}
            {count === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Open
              </Typography>
            )}
            {count > preview.length && (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                +{count - preview.length} more
              </Typography>
            )}
          </Stack>
        </Box>
      );
    },
    [
      bookingDensity.map,
      bookingDensity.max,
      bookingsByDate,
      formatBookingTime,
      handleSelectDate,
      selectedDate,
      theme,
      today,
      viewMonthStart
    ]
  );

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100%',
        width: '100%',
        overflowX: 'clip',
        background: 'linear-gradient(180deg, #f6f8fc 0%, #f2f5fa 34%, #ffffff 100%)'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(52rem 25rem at 14% -8%, ${alpha('#91adff', 0.32)} 0%, transparent 60%),
            radial-gradient(48rem 22rem at 96% -10%, ${alpha('#f2a2b4', 0.24)} 0%, transparent 58%)
          `
        }}
      />

      <Stack
        spacing={2.3}
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          boxSizing: 'border-box',
          px: { xs: 1, sm: 2, md: 3 },
          py: { xs: 2, md: 3 }
        }}
      >
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: `1px solid ${alpha('#bdcaf5', 0.62)}`,
            background: `linear-gradient(145deg, ${alpha('#fffefe', 0.98)} 0%, ${alpha('#eef2ff', 0.96)} 100%)`,
            boxShadow: '0 14px 34px rgba(67, 87, 150, 0.12)',
            px: { xs: 2, md: 2.8 },
            py: { xs: 2.1, md: 2.5 }
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.8}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Stack spacing={0.65}>
              <Typography variant="overline" sx={{ color: '#6a79a8', fontWeight: 700, letterSpacing: 1.2 }}>
                Performance View
              </Typography>
              <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.03em', color: '#273456' }}>
                Management Insights
              </Typography>
              <Typography variant="body2" sx={{ color: '#6777a0' }}>
                Premium calendar workspace with live booking focus.
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<CalendarTodayIcon />}
                label={`${totalBookings} booking${totalBookings === 1 ? '' : 's'} in ${viewMonthStart.format('MMMM')}`}
                sx={{
                  borderRadius: 1.5,
                  color: '#4866a6',
                  backgroundColor: alpha('#8da2ff', 0.18),
                  border: `1px solid ${alpha('#7f96e6', 0.4)}`,
                  '& .MuiChip-icon': {
                    color: '#4d70b6'
                  }
                }}
              />
              <Button
                component={RouterLink}
                to="/orders/new"
                variant="contained"
                sx={{
                  borderRadius: 1.5,
                  px: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  backgroundColor: '#4e71d8',
                  boxShadow: '0 8px 20px rgba(78, 113, 216, 0.24)',
                  '&:hover': {
                    backgroundColor: '#4163c6',
                    boxShadow: '0 8px 20px rgba(65, 99, 198, 0.28)'
                  }
                }}
              >
                Add Booking
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Card
          sx={{
            borderRadius: 3,
            border: `1px solid ${alpha('#c4cff0', 0.58)}`,
            backgroundColor: alpha(theme.palette.background.paper, 0.94),
            boxShadow: '0 14px 34px rgba(51, 70, 122, 0.1)'
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stack spacing={1.2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" rowGap={1}>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <IconButton
                    size="small"
                    onClick={goToPreviousMonth}
                    sx={{ borderRadius: 1.5, border: `1px solid ${alpha('#8ea3e6', 0.38)}` }}
                  >
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#2f3f66' }}>
                    {viewMonthStart.format('MMMM YYYY')}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={goToNextMonth}
                    sx={{ borderRadius: 1.5, border: `1px solid ${alpha('#8ea3e6', 0.38)}` }}
                  >
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Button
                  variant="outlined"
                  onClick={jumpToToday}
                  sx={{
                    borderRadius: 1.5,
                    textTransform: 'none',
                    color: '#4f66a1',
                    borderColor: alpha('#8fa3e7', 0.55)
                  }}
                >
                  Jump to Today
                </Button>
              </Stack>

              <Grid container spacing={1.2}>
                <Grid item xs={12} lg={8.6}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                      gap: 0.65,
                      mb: 0.65
                    }}
                  >
                    {WEEKDAY_LABELS.map((label) => (
                      <Box
                        key={label}
                        sx={{
                          py: 0.45,
                          borderRadius: 1.2,
                          border: `1px solid ${alpha('#c4ceea', 0.58)}`,
                          textAlign: 'center',
                          backgroundColor: '#f1f5ff'
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5, color: '#6a7dac' }}>
                          {label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <Box
                    role="grid"
                    aria-label="Current month booking calendar"
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                      gap: 0.65,
                      borderRadius: 2,
                      border: `1px solid ${alpha('#c1cbeb', 0.55)}`,
                      p: 0.65,
                      backgroundColor: alpha('#eef3ff', 0.9)
                    }}
                  >
                    {calendarCells.map((day, index) => renderCalendarDay(day, index))}
                  </Box>
                </Grid>

                <Grid item xs={12} lg={3.4}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      borderRadius: 2,
                      border: `1px solid ${alpha('#c3cdee', 0.56)}`,
                      background: `linear-gradient(165deg, ${alpha('#fbfcff', 0.95)} 0%, ${alpha('#f0f4ff', 0.98)} 100%)`,
                      p: 1.3
                    }}
                  >
                    <Stack spacing={1.05}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="overline" sx={{ letterSpacing: 1, color: '#6b7ea8' }}>
                          Selected Day
                        </Typography>
                        <Chip
                          size="small"
                          label={`${selectedBookings.length} booking${selectedBookings.length === 1 ? '' : 's'}`}
                          sx={{
                            borderRadius: 1.2,
                            height: 20,
                            fontWeight: 700,
                            color: '#516da7',
                            backgroundColor: alpha('#8ea3eb', 0.18),
                            border: `1px solid ${alpha('#8ea3eb', 0.38)}`
                          }}
                        />
                      </Stack>
                      <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1, color: '#31436e' }}>
                        {selectedDate.format('D')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#6378a5' }}>
                        {selectedDate.format('dddd, MMMM')}
                      </Typography>
                      <Divider />
                      <Stack spacing={0.75}>
                        {selectedBookings.length > 0 ? (
                          selectedBookings.map((booking) => {
                            const palette = getServicePalette(booking.serviceType);
                            return (
                              <Box
                                key={`selected-${booking.id}`}
                                sx={{
                                  borderRadius: 1.4,
                                  border: `1px solid ${alpha('#c3cded', 0.62)}`,
                                  borderLeft: `3px solid ${palette.accent}`,
                                  backgroundColor: palette.background,
                                  px: 0.9,
                                  py: 0.75
                                }}
                              >
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                                  {formatBookingTime(booking.date, booking.time)}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#556b95' }}>
                                  {booking.customer}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#7281a3' }}>
                                  Party of {booking.partySize}
                                </Typography>
                              </Box>
                            );
                          })
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No bookings on this date.
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: 3,
            border: `1px solid ${alpha('#c4cff0', 0.58)}`,
            backgroundColor: alpha(theme.palette.background.paper, 0.94),
            boxShadow: '0 14px 34px rgba(51, 70, 122, 0.1)'
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stack spacing={1.2}>
              <Stack direction="row" spacing={0.9} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={0.8} alignItems="center">
                  <AccessTimeRoundedIcon fontSize="small" sx={{ color: '#5670b8' }} />
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#2d3f6c' }}>
                    Upcoming Bookings Timeline
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: '#6076a1' }}>
                  {monthlyGuestCount} guests expected this month
                </Typography>
              </Stack>

              {upcomingTimeline.length > 0 ? (
                <Stack spacing={0.8}>
                  {upcomingTimeline.map((booking) => {
                    const palette = getServicePalette(booking.serviceType);
                    return (
                      <Paper
                        key={`timeline-${booking.id}`}
                        elevation={0}
                        sx={{
                          borderRadius: 1.6,
                          border: `1px solid ${alpha('#c3cdee', 0.58)}`,
                          background: `linear-gradient(120deg, ${alpha('#ffffff', 0.96)} 0%, ${alpha(palette.background, 0.95)} 100%)`,
                          px: 1.1,
                          py: 0.9
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack spacing={0.2}>
                            <Typography variant="caption" sx={{ color: '#6076a6', fontWeight: 700 }}>
                              {dayjs(booking.date).format('ddd, MMM D')} | {formatBookingTime(booking.date, booking.time)}
                            </Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2f4571' }}>
                              {booking.customer}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.7} alignItems="center">
                            <Chip
                              size="small"
                              label={palette.label}
                              sx={{
                                borderRadius: 1.1,
                                height: 22,
                                fontWeight: 700,
                                color: palette.accent,
                                backgroundColor: alpha(palette.accent, 0.12),
                                border: `1px solid ${alpha(palette.accent, 0.32)}`
                              }}
                            />
                            <Chip
                              size="small"
                              icon={<EventAvailableOutlinedIcon />}
                              label={`${booking.partySize}`}
                              sx={{ borderRadius: 1.1, height: 22, fontWeight: 700 }}
                            />
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No upcoming bookings yet.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default ManagementDashboardPage;
