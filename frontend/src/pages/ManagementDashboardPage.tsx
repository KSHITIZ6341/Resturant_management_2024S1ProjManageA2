
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { alpha, useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import dayjs, { Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(advancedFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

interface BookingEntry {
  id: string;
  customer: string;
  date: string;
  time?: string;
  partySize: number;
  notes?: string;
  serviceType?: string;
  source: 'order';
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

interface SummaryMetric {
  label: string;
  value: string;
  caption: string;
  icon: React.ElementType;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
}

const toTitleCase = (value: string) => value
  .split(' ')
  .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ''))
  .join(' ');
const ManagementDashboardPage: React.FC = () => {
  const theme = useTheme();
  const today = useMemo(() => dayjs().startOf('day'), []);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(today);
  const [orders, setOrders] = useState<OrderApiResponse[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const listContainerRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch('http://127.0.0.1:5000/api/orders')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load orders (${response.status})`);
        }
        return response.json();
      })
      .then((data: OrderApiResponse[]) => {
        if (isMounted) {
          setOrders(data);
        }
      })
      .catch((error) => {
        console.error('Unable to load orders for dashboard calendar:', error);
      })
      .finally(() => {
        if (isMounted) {
          setOrdersLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const [viewMonthStart, setViewMonthStart] = useState<Dayjs>(today.startOf('month'));
  const daysInMonth = viewMonthStart.daysInMonth();

  const orderBookings = useMemo<BookingEntry[]>(() => {
    if (!ordersLoaded || orders.length === 0) {
      return [];
    }

    return orders
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
          notes: order.service_type ? `${order.service_type} service` : undefined,
          serviceType: order.service_type,
          source: 'order'
        };
      });
  }, [orders, ordersLoaded]);

  const activeBookings = useMemo<BookingEntry[]>(() => {
    if (!ordersLoaded) {
      return [];
    }
    return orderBookings;
  }, [orderBookings, ordersLoaded]);

  const bookingsByDate = useMemo<Record<string, BookingEntry[]>>(() => {
    const grouped: Record<string, BookingEntry[]> = {};
    activeBookings.forEach((booking) => {
      if (!grouped[booking.date]) {
        grouped[booking.date] = [];
      }
      grouped[booking.date].push(booking);
    });
    return grouped;
  }, [activeBookings]);

  const bookingDensity = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;

    activeBookings.forEach((booking) => {
      const count = (map.get(booking.date) ?? 0) + 1;
      map.set(booking.date, count);
      max = Math.max(max, count);
    });

    return { map, max };
  }, [activeBookings]);

  const calendarCells = useMemo(() => {
    const leading = viewMonthStart.day();
    const dates = Array.from({ length: daysInMonth }, (_, index) => viewMonthStart.add(index, 'day'));
    const trailing = (7 - ((leading + dates.length) % 7)) % 7;
    const emptyBefore = Array.from({ length: leading }, () => null);
    const emptyAfter = Array.from({ length: trailing }, () => null);
    return [...emptyBefore, ...dates, ...emptyAfter];
  }, [viewMonthStart, daysInMonth]);

  const monthBookings = useMemo(
    () => activeBookings.filter((booking) => dayjs(booking.date).isSame(viewMonthStart, 'month')),
    [activeBookings, viewMonthStart]
  );

  const upcomingBookings = useMemo(
    () => monthBookings.filter((booking) => {
      const date = dayjs(booking.date);
      return date.isSame(today, 'day') || date.isAfter(today, 'day');
    }),
    [monthBookings, today]
  );

  const totalGuestsScheduled = useMemo(
    () => monthBookings.reduce((accumulator, booking) => accumulator + booking.partySize, 0),
    [monthBookings]
  );

  const totalBookings = monthBookings.length;

  const averageLeadTime = useMemo(() => {
    if (upcomingBookings.length === 0) {
      return 0;
    }
    const totalDaysAhead = upcomingBookings.reduce((accumulator, booking) => {
      const diff = dayjs(booking.date).diff(today, 'day');
      return accumulator + Math.max(diff, 0);
    }, 0);
    return totalDaysAhead / upcomingBookings.length;
  }, [today, upcomingBookings]);

  const topService = useMemo(() => {
    if (monthBookings.length === 0) {
      return null;
    }

    const counts = monthBookings.reduce((accumulator, booking) => {
      const key = booking.serviceType ?? 'General seating';
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {} as Record<string, number>);

    const entries = Object.entries(counts);
    if (entries.length === 0) {
      return null;
    }

    const [service, count] = entries.sort((a, b) => b[1] - a[1])[0];
    return { service, count };
  }, [monthBookings]);

  const dayWithMostBookings = useMemo(() => {
    if (monthBookings.length === 0) {
      return null;
    }

    const counts = monthBookings.reduce((accumulator, booking) => {
      const key = booking.date;
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {} as Record<string, number>);

    const entries = Object.entries(counts);
    if (entries.length === 0) {
      return null;
    }

    const [peakDate, count] = entries.sort((a, b) => b[1] - a[1])[0];
    return { date: peakDate, count };
  }, [monthBookings]);

  const monthSchedule = useMemo(
    () =>
      Object.entries(bookingsByDate)
        .map(([date, entries]) => ({
          date,
          label: dayjs(date).format('dddd, MMM D'),
          count: entries.length,
          bookings: entries
            .slice()
            .sort((a, b) => {
              if (!a.time && !b.time) {
                return a.customer.localeCompare(b.customer);
              }
              if (!a.time) {
                return 1;
              }
              if (!b.time) {
                return -1;
              }
              return a.time.localeCompare(b.time);
            })
        }))
        .filter((entry) => dayjs(entry.date).isSame(viewMonthStart, 'month'))
        .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()),
    [bookingsByDate, viewMonthStart]
  );

  const selectedDateKey = selectedDate.format('YYYY-MM-DD');

  const selectedDaySchedule = useMemo(
    () => monthSchedule.find((entry) => entry.date === selectedDateKey) ?? null,
    [monthSchedule, selectedDateKey]
  );

  const selectedBookings = selectedDaySchedule?.bookings ?? [];

  const upcomingFocus = useMemo(
    () =>
      monthSchedule
        .filter((entry) => {
          const date = dayjs(entry.date);
          return date.isSame(today, 'day') || date.isAfter(today, 'day');
        })
        .slice(0, 3),
    [monthSchedule, today]
  );

  const weekBounds = useMemo(() => {
    const start = today.startOf('week');
    return {
      start,
      end: start.endOf('week')
    };
  }, [today]);

  const thisWeekBookings = useMemo(() => {
    return activeBookings
      .filter((booking) => {
        const date = dayjs(booking.date);
        return date.isSameOrAfter(weekBounds.start, 'day') && date.isSameOrBefore(weekBounds.end, 'day');
      })
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
  }, [activeBookings, weekBounds]);

  const averagePartySize = useMemo(() => {
    if (monthBookings.length === 0) {
      return 0;
    }
    return totalGuestsScheduled / monthBookings.length;
  }, [monthBookings, totalGuestsScheduled]);

  const daysWithBookings = useMemo(() => {
    const uniqueDays = new Set(monthBookings.map((booking) => booking.date));
    return uniqueDays.size;
  }, [monthBookings]);

  const summaryMetrics = useMemo<SummaryMetric[]>(
    () => [
      {
        label: 'Bookings Scheduled',
        value: totalBookings.toLocaleString(),
        caption: `${viewMonthStart.format('MMMM YYYY')} confirmed bookings`,
        icon: CalendarTodayIcon,
        color: 'warning'
      },
      {
        label: 'Guests Expected',
        value: totalGuestsScheduled.toLocaleString(),
        caption: 'Projected guests from current orders',
        icon: GroupIcon,
        color: 'info'
      },
      {
        label: 'Average Party Size',
        value: averagePartySize > 0 ? averagePartySize.toFixed(1).replace(/\.0$/, '') : '0',
        caption: 'Guests per booking this month',
        icon: RestaurantIcon,
        color: 'success'
      },
      {
        label: 'Active Service Days',
        value: daysWithBookings.toLocaleString(),
        caption: 'Days with at least one scheduled party',
        icon: AccessTimeIcon,
        color: 'primary'
      }
    ],
    [averagePartySize, daysWithBookings, totalBookings, totalGuestsScheduled, viewMonthStart]
  );
  const insightHighlights = useMemo(() => {
    const leadTimeLabel = averageLeadTime > 0 ? `${averageLeadTime.toFixed(1).replace(/\.0$/, '')} days` : 'Same-day';
    const leadTimeHelper = upcomingBookings.length > 0
      ? 'Average days guests book in advance.'
      : 'Awaiting upcoming bookings.';
    const busiestDayLabel = dayWithMostBookings
      ? dayjs(dayWithMostBookings.date).format('dddd, MMM D')
      : 'No data yet';
    const busiestDayHelper = dayWithMostBookings
      ? `${dayWithMostBookings.count} parties locked in`
      : 'Add bookings to see trends.';
    const topServiceLabel = topService ? toTitleCase(topService.service) : 'TBD';
    const topServiceHelper = topService ? `${topService.count} groups prefer this experience` : 'No service trends yet.';

    return [
      {
        title: 'Busiest day',
        value: busiestDayLabel,
        helper: busiestDayHelper,
        icon: WhatshotIcon
      },
      {
        title: 'Average lead time',
        value: leadTimeLabel,
        helper: leadTimeHelper,
        icon: AccessTimeIcon
      },
      {
        title: 'Top service',
        value: topServiceLabel,
        helper: topServiceHelper,
        icon: RestaurantIcon
      }
    ];
  }, [averageLeadTime, upcomingBookings.length, dayWithMostBookings, topService]);

  const thisWeekGuestCount = useMemo(
    () => thisWeekBookings.reduce((accumulator, booking) => accumulator + booking.partySize, 0),
    [thisWeekBookings]
  );

  const thisWeekPreview = useMemo(() => thisWeekBookings.slice(0, 4), [thisWeekBookings]);

  const scrollToDate = useCallback((dateKey: string) => {
    const container = listContainerRef.current;
    if (!container) {
      return;
    }
    const target = container.querySelector<HTMLElement>(`[data-booking-date="${dateKey}"]`);
    if (target) {
      container.scrollTo({ top: Math.max(target.offsetTop - 24, 0), behavior: 'smooth' });
    }
  }, []);

  const changeMonth = useCallback((offset: number) => {
    setViewMonthStart((previous) => {
      const next = previous.add(offset, 'month');
      setSelectedDate((current) => {
        if (current.isSame(next, 'month')) {
          return current;
        }
        const desiredDay = current.date();
        const clampedDay = Math.min(desiredDay, next.daysInMonth());
        return next.date(clampedDay).startOf('day');
      });
      return next;
    });
  }, []);

  const goToPreviousMonth = useCallback(() => changeMonth(-1), [changeMonth]);
  const goToNextMonth = useCallback(() => changeMonth(1), [changeMonth]);

  const jumpToToday = useCallback(() => {
    const monthStart = today.startOf('month');
    setViewMonthStart(monthStart);
    setSelectedDate(today);
    scrollToDate(today.format('YYYY-MM-DD'));
  }, [scrollToDate, today]);

  const formatBookingTime = useCallback((date: string, time?: string) => {
    if (!time) {
      return 'Time TBD';
    }
    const parsed = dayjs(`${date} ${time}`);
    return parsed.isValid() ? parsed.format('h:mm A') : time;
  }, []);

  const handleSelectDate = useCallback(
    (day: Dayjs) => {
      if (!day.isSame(viewMonthStart, 'month')) {
        return;
      }
      setSelectedDate(day);
      scrollToDate(day.format('YYYY-MM-DD'));
    },
    [viewMonthStart, scrollToDate]
  );

  useEffect(() => {
    if (!selectedDate.isSame(viewMonthStart, 'month')) {
      setSelectedDate(viewMonthStart);
    }
  }, [selectedDate, viewMonthStart]);

  useEffect(() => {
    scrollToDate(selectedDateKey);
  }, [selectedDateKey, scrollToDate, monthSchedule.length, viewMonthStart]);

  const renderCalendarDay = useCallback(
    (day: Dayjs | null, index: number) => {
      if (!day) {
        return <Box key={`blank-${index}`} sx={{ minHeight: { xs: 64, md: 72 } }} />;
      }

      if (!day.isSame(viewMonthStart, 'month')) {
        return <Box key={day.format('YYYY-MM-DD')} sx={{ minHeight: { xs: 64, md: 72 } }} />;
      }

      const dateKey = day.format('YYYY-MM-DD');
      const bookingsForDay = bookingsByDate[dateKey] ?? [];
      const count = bookingDensity.map.get(dateKey) ?? 0;
      const isToday = day.isSame(today, 'day');
      const isSelected = day.isSame(selectedDate, 'day');
      const intensity = bookingDensity.max > 0 ? count / bookingDensity.max : 0;
      const baseBackground = count > 0
        ? alpha(theme.palette.primary.main, 0.25 + intensity * 0.45)
        : theme.palette.background.paper;
      const borderColor = isSelected
        ? theme.palette.primary.main
        : isToday
          ? theme.palette.success.main
          : alpha(theme.palette.divider, 0.7);

      const tooltipContent = bookingsForDay.length === 0
        ? 'No bookings yet'
        : (
          <Stack spacing={0.4}>
            {bookingsForDay.slice(0, 4).map((booking) => (
              <Typography key={booking.id} variant="caption">
                {`${formatBookingTime(booking.date, booking.time)} | ${booking.customer}`}
              </Typography>
            ))}
            {bookingsForDay.length > 4 && (
              <Typography variant="caption" color="text.secondary">
                {`+${bookingsForDay.length - 4} more`}
              </Typography>
            )}
          </Stack>
        );

      return (
        <Tooltip
          key={dateKey}
          title={tooltipContent}
          placement="top"
          arrow
          disableFocusListener={bookingsForDay.length === 0}
        >
          <Box
            role="gridcell"
            aria-selected={isSelected}
            onClick={() => handleSelectDate(day)}
            sx={{
              cursor: 'pointer',
              minHeight: { xs: 64, md: 72 },
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              p: 1.2,
              border: `1px solid ${borderColor}`,
              backgroundColor: isSelected
                ? alpha(theme.palette.primary.main, 0.2)
                : baseBackground,
              boxShadow: isSelected
                ? `0 12px 24px ${alpha(theme.palette.primary.main, 0.2)}`
                : 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.18)}`
              }
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body1" fontWeight={isSelected ? 700 : 600}>
                {day.date()}
              </Typography>
              {isToday && (
                <Chip
                  size="small"
                  label="Today"
                  color="success"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 600
                  }}
                />
              )}
            </Stack>
            {count > 0 && (
              <Chip
                size="small"
                label={`${count} booking${count > 1 ? 's' : ''}`}
                sx={{
                  mt: 1,
                  alignSelf: 'flex-end',
                  fontWeight: 600,
                  height: 24,
                  backgroundColor: alpha(
                    theme.palette.primary.main,
                    isSelected ? 0.35 : 0.2
                  ),
                  color: theme.palette.primary.dark
                }}
              />
            )}
          </Box>
        </Tooltip>
      );
    },
    [bookingDensity.max, bookingDensity.map, bookingsByDate, viewMonthStart, formatBookingTime, handleSelectDate, selectedDate, theme, today]
  );
  return (
    <Box
      sx={{
        width: '100vw',
        position: 'relative',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: alpha(theme.palette.background.default, 1)
      }}
    >
      <Stack
        spacing={4}
        sx={{
          width: '100%',
          boxSizing: 'border-box',
          px: { xs: 2, sm: 3, md: 5, lg: 6 },
          py: { xs: 3, md: 4, lg: 5 }
        }}
      >
        <Paper
          elevation={0}
          sx={{
            borderRadius: 6,
            overflow: 'hidden',
            position: 'relative',
            color: theme.palette.common.white,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.92)} 0%, ${theme.palette.primary.dark} 100%)`,
            px: { xs: 3, md: 4 },
            py: { xs: 4, md: 5 }
          }}
        >
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Stack spacing={1.5}>
                <Chip
                  size="medium"
                  label={`Current month: ${viewMonthStart.format('MMMM YYYY')}`}
                  sx={{
                    alignSelf: 'flex-start',
                    backgroundColor: alpha(theme.palette.common.white, 0.16),
                    color: theme.palette.common.white,
                    fontWeight: 600
                  }}
                />
                <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
                  Management Insights
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    maxWidth: 640,
                    color: alpha(theme.palette.common.white, 0.85)
                  }}
                >
                  Track reservations, premium revenue, and guest engagement across the month in one streamlined view.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" rowGap={1.5}>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<CalendarTodayIcon />}
                  onClick={jumpToToday}
                  sx={{
                    color: theme.palette.common.white,
                    boxShadow: '0 14px 30px rgba(255, 255, 255, 0.15)'
                  }}
                >
                  Jump to today
                </Button>
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to="/orders/new"
                  sx={{
                    borderColor: alpha(theme.palette.common.white, 0.6),
                    color: theme.palette.common.white,
                    fontWeight: 600
                  }}
                >
                  Add booking
                </Button>
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', xl: 'row' },
                gap: { xs: 2, xl: 3 },
                alignItems: 'stretch'
              }}
            >
              <Box
                sx={{
                  flexBasis: { xl: '38%' },
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  backgroundColor: alpha(theme.palette.common.white, 0.14),
                  borderRadius: 3,
                  p: 2.5
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="overline" sx={{ letterSpacing: 1.4 }}>
                    This Week's Bookings
                  </Typography>
                  <Chip
                    size="small"
                    label={`${thisWeekBookings.length} booking${thisWeekBookings.length === 1 ? '' : 's'}`}
                    sx={{
                      fontWeight: 600,
                      backgroundColor: alpha(theme.palette.common.white, 0.2),
                      color: theme.palette.common.white
                    }}
                  />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="h5" fontWeight={700}>
                    {thisWeekGuestCount} guest{thisWeekGuestCount === 1 ? '' : 's'} expected
                  </Typography>
                  <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.75) }}>
                    {`Week of ${weekBounds.start.format('MMM D')} - ${weekBounds.end.format('MMM D')}`}
                  </Typography>
                </Stack>
                <Stack spacing={1.2}>
                  {thisWeekPreview.length > 0 ? (
                    thisWeekPreview.map((booking) => (
                      <Stack
                        key={booking.id}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          backgroundColor: alpha(theme.palette.common.white, 0.12),
                          borderRadius: 2,
                          px: 1.5,
                          py: 1
                        }}
                      >
                        <Stack spacing={0.3}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {dayjs(booking.date).format('ddd, MMM D')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.7) }}>
                            {formatBookingTime(booking.date, booking.time)} - {booking.customer}
                          </Typography>
                        </Stack>
                        <Chip
                          size="small"
                          label={`Party of ${booking.partySize}`}
                          sx={{
                            fontWeight: 600,
                            backgroundColor: alpha(theme.palette.common.white, 0.28),
                            color: theme.palette.common.white
                          }}
                        />
                      </Stack>
                    ))
                  ) : (
                    <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.75) }}>
                      No bookings on the books for this week yet.
                    </Typography>
                  )}
                </Stack>
              </Box>

              <Box
                sx={{
                  flexBasis: { xl: '62%' },
                  flexGrow: 1,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))'
                  },
                  gap: 2
                }}
              >
                {summaryMetrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <Box
                      key={metric.label}
                      sx={{
                        backgroundColor: alpha(theme.palette.common.white, 0.12),
                        borderRadius: 3,
                        p: 2.5,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        minHeight: 140
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.common.white, 0.24),
                            color: theme.palette.common.white,
                            width: 48,
                            height: 48
                          }}
                        >
                          <Icon />
                        </Avatar>
                        <Stack spacing={0.4}>
                          <Typography variant="overline" sx={{ letterSpacing: 1.4 }}>
                            {metric.label}
                          </Typography>
                          <Typography variant="h5" fontWeight={700} color="common.white">
                            {metric.value}
                          </Typography>
                        </Stack>
                      </Stack>
                      <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.75) }}>
                        {metric.caption}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              {insightHighlights.map((highlight) => {
                const Icon = highlight.icon;
                return (
                  <Grid item key={highlight.title} xs={12} md={4}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        backgroundColor: alpha(theme.palette.common.white, 0.12),
                        borderRadius: 3,
                        p: 2.5,
                        height: '100%'
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: alpha(theme.palette.common.white, 0.24),
                          color: theme.palette.common.white,
                          width: 52,
                          height: 52
                        }}
                      >
                        <Icon />
                      </Avatar>
                      <Stack spacing={0.6}>
                        <Typography variant="overline" sx={{ letterSpacing: 1.4 }}>
                          {highlight.title}
                        </Typography>
                        <Typography variant="h6" fontWeight={700}>
                          {highlight.value}
                        </Typography>
                        <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.75) }}>
                          {highlight.helper}
                        </Typography>
                      </Stack>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Stack>
        </Paper>

        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} lg={8}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 4,
                boxShadow: '0 22px 45px rgba(15, 23, 42, 0.12)'
              }}
            >
              <CardHeader
                title="Bookings calendar"
                subheader={`Current month view - ${viewMonthStart.format('MMMM YYYY')}`}
                action={
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`${totalBookings} booking${totalBookings === 1 ? '' : 's'}`}
                    sx={{ fontWeight: 600 }}
                  />
                }
              />
              <CardContent>
                <Stack spacing={3}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Stack spacing={0.75}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton
                          size="small"
                          aria-label="Previous month"
                          onClick={goToPreviousMonth}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.text.primary, 0.2)}`,
                            borderRadius: 2,
                            color: 'text.secondary'
                          }}
                        >
                          <ChevronLeftIcon fontSize="small" />
                        </IconButton>
                        <Typography variant="h5" fontWeight={700}>
                          {viewMonthStart.format('MMMM YYYY')}
                        </Typography>
                        <IconButton
                          size="small"
                          aria-label="Next month"
                          onClick={goToNextMonth}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.text.primary, 0.2)}`,
                            borderRadius: 2,
                            color: 'text.secondary'
                          }}
                        >
                          <ChevronRightIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      <Typography variant="subtitle2" color="text.secondary">
                        Selected: {selectedDate.format('dddd, MMM D')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedBookings.length > 0
                          ? `${selectedBookings.length} booking${selectedBookings.length > 1 ? 's' : ''} scheduled`
                          : 'No bookings scheduled for this day yet.'}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={`High water mark: ${bookingDensity.max}`}
                        sx={{ fontWeight: 600 }}
                      />
                      <Button
                        variant="text"
                        startIcon={<CalendarTodayIcon />}
                        onClick={jumpToToday}
                        sx={{ fontWeight: 600 }}
                      >
                        Today
                      </Button>
                    </Stack>
                  </Stack>

                  <Box
                    role="grid"
                    aria-label="Current month booking calendar"
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                      gap: { xs: 1, sm: 1.5 }
                    }}
                  >
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                      <Typography
                        key={label}
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6
                        }}
                      >
                        {label}
                      </Typography>
                    ))}
                    {calendarCells.map((day, index) => renderCalendarDay(day, index))}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 4,
                boxShadow: '0 22px 45px rgba(15, 23, 42, 0.12)'
              }}
            >
              <CardHeader
                title="Upcoming bookings"
                subheader={`Guests confirmed for ${viewMonthStart.format('MMMM YYYY')}`}
              />
              <CardContent sx={{ pt: 0 }}>
                {monthSchedule.length > 0 ? (
                  <List
                    dense
                    ref={listContainerRef}
                    sx={{
                      maxHeight: 460,
                      overflowY: 'auto',
                      pr: 1
                    }}
                  >
                    {monthSchedule.map((entry, entryIndex) => (
                      <React.Fragment key={entry.date}>
                        <ListItem
                          disableGutters
                          onClick={() => handleSelectDate(dayjs(entry.date))}
                          sx={{
                            mb: 1,
                            alignItems: 'flex-start',
                            flexDirection: 'column',
                            borderRadius: 3,
                            border: entry.date === selectedDateKey
                              ? `1px solid ${alpha(theme.palette.primary.main, 0.35)}`
                              : `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                            backgroundColor: entry.date === selectedDateKey
                              ? alpha(theme.palette.primary.main, 0.08)
                              : alpha(theme.palette.background.default, 0.7),
                            px: 2,
                            py: 1.5,
                            cursor: 'pointer',
                            transition: 'border-color 0.2s ease'
                          }}
                          data-booking-date={entry.date}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="subtitle2" fontWeight={700}>
                              {entry.label}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${entry.count}`}
                              color="primary"
                              variant={entry.date === selectedDateKey ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 600 }}
                            />
                          </Stack>
                        </ListItem>
                        {entry.bookings.map((booking) => (
                          <ListItem
                            key={booking.id}
                            sx={{
                              pl: 3.5,
                              py: 1,
                              alignItems: 'flex-start'
                            }}
                          >
                            <ListItemAvatar>
                              <Avatar
                                sx={{
                                  bgcolor: alpha(theme.palette.warning.main, 0.16),
                                  color: theme.palette.warning.main,
                                  fontWeight: 700
                                }}
                              >
                                {Math.max(1, booking.partySize)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Stack direction="row" spacing={1.2} alignItems="center">
                                  <Chip
                                    size="small"
                                    label={formatBookingTime(booking.date, booking.time)}
                                    variant="outlined"
                                    sx={{ fontWeight: 600, height: 22 }}
                                  />
                                  <Typography variant="body2" fontWeight={600}>
                                    {booking.customer}
                                  </Typography>
                                </Stack>
                              }
                              secondary={[
                                booking.serviceType,
                                booking.notes,
                                `Party of ${booking.partySize}`
                              ]
                                .filter(Boolean)
                                .join(' | ')}
                              secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                            />
                          </ListItem>
                        ))}
                        {entryIndex < monthSchedule.length - 1 && <Divider sx={{ my: 1.5 }} />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      No bookings yet this month
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Add an order to populate the calendar instantly.
                    </Typography>
                    <Button variant="contained" href="/orders/new" sx={{ mt: 1 }}>
                      Create booking
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 4,
                boxShadow: '0 22px 45px rgba(15, 23, 42, 0.12)'
              }}
            >
              <CardHeader
                title="This week's focus"
                subheader="Primary services to prepare"
              />
              <CardContent>
                <Stack spacing={2.5}>
                  {upcomingFocus.length > 0 ? (
                    upcomingFocus.map((slot) => (
                      <Box
                        key={slot.date}
                        sx={{
                          borderRadius: 3,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                          p: 2.2
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack spacing={0.4}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {slot.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {`${slot.count} booking${slot.count > 1 ? 's' : ''} scheduled`}
                            </Typography>
                          </Stack>
                          <Avatar
                            sx={{
                              width: 44,
                              height: 44,
                              bgcolor: alpha(theme.palette.primary.main, 0.18),
                              color: theme.palette.primary.main
                            }}
                          >
                            <EventSeatIcon />
                          </Avatar>
                        </Stack>
                        <Divider sx={{ my: 1.5 }} />
                        <Stack spacing={1.2}>
                          {slot.bookings.slice(0, 3).map((booking) => (
                            <Stack
                              key={booking.id}
                              direction="row"
                              spacing={1.5}
                              alignItems="center"
                            >
                              <Chip
                                size="small"
                                label={formatBookingTime(booking.date, booking.time)}
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 600 }}
                              />
                              <Typography variant="body2" fontWeight={600}>
                                {booking.customer}
                              </Typography>
                            </Stack>
                          ))}
                          {slot.bookings.length > 3 && (
                            <Typography variant="caption" color="text.secondary">
                              {`+${slot.bookings.length - 3} additional parties`}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    ))
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        No upcoming bookings
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Once new reservations are added they will appear here automatically.
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
};

export default ManagementDashboardPage;
