import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import config from '@/config';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import BookingModal from '../BookingModal';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

// Custom Time Slot Wrapper for Hover Effect
const CustomTimeSlotWrapper = (props: any) => {
    const { children, value } = props;
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative flex-1"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children}
            {isHovered && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-start pl-1">
                    <span className="text-[10px] font-bold text-indigo-600 bg-white/90 px-1 rounded shadow-sm backdrop-blur-sm border border-indigo-100">
                        Start: {format(value, 'HH:mm')}
                    </span>
                </div>
            )}
        </div>
    );
};

export default function AdminCalendar() {
    const router = useRouter();
    const { isGuest, user: currentUser } = useAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
    // Default view to 'week' and load from localStorage
    const [view, setView] = useState<any>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('calendarView') || 'week';
        }
        return 'week';
    });
    const [date, setDate] = useState(new Date());

    // Time Range Customization
    const [startHour, setStartHour] = useState(7);
    const [endHour, setEndHour] = useState(18);

    // Event Selection for Modal
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Create Booking State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createData, setCreateData] = useState<any>(null);
    const [showRangeControls, setShowRangeControls] = useState(false);

    // Current time for time indicator
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Load from localStorage
        const savedStart = localStorage.getItem('calendarStartHour');
        const savedEnd = localStorage.getItem('calendarEndHour');
        if (savedStart) setStartHour(parseInt(savedStart));
        if (savedEnd) setEndHour(parseInt(savedEnd));

        // Ensure defaulting to week if not set (redundant but safe)
        const savedView = localStorage.getItem('calendarView');
        if (savedView) setView(savedView);
    }, []);

    const handleStartHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = parseInt(e.target.value);
        setStartHour(val);
        localStorage.setItem('calendarStartHour', val.toString());
    };

    const handleEndHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = parseInt(e.target.value);
        setEndHour(val);
        localStorage.setItem('calendarEndHour', val.toString());
    };

    const handleSelectSlot = async (slotInfo: any) => {
        // Guest cannot create bookings - show popup
        if (isGuest) {
            const result = await Swal.fire({
                title: 'Login Required',
                text: 'You must be logged in to book a room.',
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Login',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                router.push('/login');
            }
            return;
        }

        // Prevent selecting past slots
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (slotInfo.start < today) {
            return;
        }

        let roomId = Number(selectedRoomId);
        if (isNaN(roomId)) {
            // Default to first room if "All Rooms" selected
            if (rooms.length > 0) roomId = rooms[0].id;
            else return;
        }

        setCreateData({
            startTime: slotInfo.start,
            endTime: slotInfo.end,
            roomId: roomId
        });
        setShowCreateModal(true);
    };

    const fetchBookings = useCallback(async () => {
        try {
            let start, end;
            const current = new Date(date);

            if (view === 'month') {
                // Fetch full month + padding for grid
                const monthStart = startOfMonth(current);
                const monthEnd = endOfMonth(current);
                start = startOfWeek(monthStart);
                end = endOfWeek(monthEnd);
            } else if (view === 'week') {
                start = startOfWeek(current);
                end = endOfWeek(current);
            } else {
                // Day view
                start = startOfDay(current);
                end = endOfDay(current);
            }

            const params = new URLSearchParams({
                startDate: start.toISOString(),
                endDate: end.toISOString()
            });

            // Fetch bookings - works for both guests and logged-in users (API is public)
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${config.apiServer}/api/bookings/all?${params}`, { headers });
            if (res.ok) {
                const data = await res.json();
                const mappedEvents = data.map((b: any) => {
                    return {
                        title: `${b.user?.employeeId || '-'} - (${b.user?.section || '-'})`,
                        start: new Date(b.startTime),
                        end: new Date(b.endTime),
                        resource: b
                    };
                });
                setEvents(mappedEvents);
            }
        } catch (error) {
            console.error(error);
        }
    }, [date, view]);

    const fetchRooms = async () => {
        try {
            // Fetch rooms - works for both guests and logged-in users (API is public)
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${config.apiServer}/api/rooms`, { headers });
            if (res.ok) {
                const data = await res.json();
                setRooms(data);
            }
        } catch (error) { console.error(error); }
    };

    // Update current time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchBookings();
        fetchRooms();

        const socket = io(config.apiServer);
        socket.on('booking_created', fetchBookings);
        socket.on('booking_updated', fetchBookings);
        socket.on('booking_deleted', fetchBookings);
        socket.on('room_update', fetchBookings);

        return () => {
            socket.disconnect();
        };
    }, [fetchBookings]);

    const onNavigate = (newDate: Date) => setDate(newDate);
    const onView = (newView: any) => {
        setView(newView);
        localStorage.setItem('calendarView', newView);
    };

    const handleSelectEvent = (event: any) => {
        setSelectedEvent(event);
    };
    const closeModal = () => setSelectedEvent(null);

    const handleCancelBooking = async (bookingId: number) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "Do you really want to delete this booking?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${config.apiServer}/api/bookings/${bookingId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                Swal.fire({ title: 'Deleted!', text: 'The booking has been deleted.', icon: 'success', timer: 800, showConfirmButton: false });
                setSelectedEvent(null);
                fetchBookings();
            } else {
                Swal.fire('Error', 'Failed to delete booking.', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'An error occurred.', 'error');
        }
    };


    const filteredEvents = selectedRoomId === 'all'
        ? events
        : events.filter(e => e.resource.roomId === Number(selectedRoomId));

    // Construct min/max dates for the view
    const minTime = new Date();
    minTime.setHours(startHour, 0, 0);
    const maxTime = new Date();
    maxTime.setHours(endHour, 0, 0);

    // Custom Header for Week View - Responsive with abbreviated day names on mobile
    const CustomWeekHeader = ({ date, label }: any) => (
        <div className="flex flex-col items-center justify-center py-1 md:py-2">
            <div className="font-bold text-slate-700 uppercase tracking-wide text-[10px] md:text-sm">
                <span className="md:hidden">{format(date, 'EEE', { locale: enUS })}</span>
                <span className="hidden md:inline">{format(date, 'EEEE', { locale: enUS })}</span>
            </div>
            <div className="text-[10px] md:text-sm font-bold text-indigo-600 bg-indigo-50 px-1.5 md:px-3 py-0.5 md:py-1 rounded-full mt-0.5 md:mt-1 border border-indigo-100">
                <span className="md:hidden">{format(date, 'd/M', { locale: enUS })}</span>
                <span className="hidden md:inline">{format(date, 'd MMM yyyy', { locale: enUS })}</span>
            </div>
        </div>
    );

    // Custom Header for Month View - Only show day name, no date/month/year
    const CustomMonthHeader = ({ date, label }: any) => (
        <div className="flex items-center justify-center py-1 md:py-2">
            <div className="font-bold text-slate-700 uppercase tracking-wide text-[10px] md:text-sm">
                <span className="md:hidden">{format(date, 'EEE', { locale: enUS })}</span>
                <span className="hidden md:inline">{format(date, 'EEEE', { locale: enUS })}</span>
            </div>
        </div>
    );

    // Room Colors Palette (Indices correspond to roomId % length)
    const ROOM_COLORS = [
        '#4f46e5', // Indigo (Default)
        '#059669', // Emerald
        '#d97706', // Amber
        '#e11d48', // Rose
        '#0891b2', // Cyan
        '#7c3aed', // Violet
        '#db2777', // Pink
        '#65a30d', // Lime
    ];

    return (
        <div className="min-h-[500px] md:min-h-[700px] bg-white p-3 md:p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-4">
                <h2 className="text-lg md:text-2xl font-bold text-slate-800">Booking Calendar</h2>

                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    {/* Time Range Controls - Hidden on mobile, shown on md+ */}
                    <div className="hidden md:flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                        <span className="text-xs font-semibold text-slate-500 pl-1">Range:</span>
                        <select
                            value={startHour}
                            onChange={handleStartHourChange}
                            className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
                        >
                            {Array.from({ length: 24 }).map((_, i) => (
                                <option key={i} value={i}>{i}:00</option>
                            ))}
                        </select>
                        <span className="text-slate-400">-</span>
                        <select
                            value={endHour}
                            onChange={handleEndHourChange}
                            className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
                        >
                            {Array.from({ length: 24 }).map((_, i) => (
                                <option key={i} value={i}>{i}:00</option>
                            ))}
                        </select>
                    </div>
                    {/* Mobile Range Toggle */}
                    <button
                        onClick={() => setShowRangeControls(!showRangeControls)}
                        className="md:hidden p-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-200"
                        title="Time Range"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>

                    <select
                        value={selectedRoomId}
                        onChange={(e) => setSelectedRoomId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs md:text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 md:p-2.5 font-medium outline-none min-w-[120px] md:min-w-[200px]"
                    >
                        <option value="all">Display All Rooms</option>
                        {rooms.map(room => (
                            <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={async () => {
                            // Guest cannot create bookings - show popup
                            if (isGuest) {
                                const result = await Swal.fire({
                                    title: 'Login Required',
                                    text: 'You must be logged in to book a room.',
                                    icon: 'info',
                                    showCancelButton: true,
                                    confirmButtonColor: '#3b82f6',
                                    cancelButtonColor: '#64748b',
                                    confirmButtonText: 'Login',
                                    cancelButtonText: 'Cancel'
                                });
                                if (result.isConfirmed) {
                                    router.push('/login');
                                }
                                return;
                            }

                            let roomId = Number(selectedRoomId);
                            if (isNaN(roomId)) roomId = rooms[0]?.id;

                            setCreateData({ roomId });
                            setShowCreateModal(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 md:py-2.5 px-3 md:px-4 rounded-xl transition-colors shadow-sm flex items-center gap-1 md:gap-2 text-sm"
                    >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        <span className="hidden md:inline">New Booking</span>
                        <span className="md:hidden">Book</span>
                    </button>
                </div>
            </div>

            {/* Mobile Range Dropdown */}
            {showRangeControls && (
                <div className="md:hidden mb-3 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-xs font-semibold text-slate-500">Range:</span>
                    <select value={startHour} onChange={handleStartHourChange} className="flex-1 bg-white text-xs rounded border px-2 py-1">
                        {Array.from({ length: 24 }).map((_, i) => (<option key={i} value={i}>{i}:00</option>))}
                    </select>
                    <span className="text-slate-400">-</span>
                    <select value={endHour} onChange={handleEndHourChange} className="flex-1 bg-white text-xs rounded border px-2 py-1">
                        {Array.from({ length: 24 }).map((_, i) => (<option key={i} value={i}>{i}:00</option>))}
                    </select>
                </div>
            )}

            {/* Room Color Legend - Compact on mobile */}
            {rooms.length > 0 && (
                <div className="mb-3 md:mb-4 flex flex-wrap items-center gap-1.5 md:gap-3 px-1 overflow-x-auto">
                    {rooms.map((room, index) => (
                        <div key={room.id} className="flex items-center gap-1" title={room.name}>
                            <span
                                className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm shadow-sm shrink-0"
                                style={{ backgroundColor: ROOM_COLORS[room.id % ROOM_COLORS.length] }}
                            />
                            <span className="text-[10px] md:text-xs font-medium text-slate-600 whitespace-nowrap">
                                {room.name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <Calendar
                localizer={localizer}
                events={filteredEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                views={['month', 'week', 'day']}
                view={view}
                date={date}
                onNavigate={onNavigate}
                onView={onView}
                min={minTime}
                max={maxTime}
                onSelectEvent={handleSelectEvent}
                selectable={true}
                onSelectSlot={handleSelectSlot}
                formats={{
                    dayFormat: (date: Date, culture: any, localizer: any) => localizer!.format(date, 'EEEE dd/MM/yyyy', culture),
                    weekdayFormat: (date: Date, culture: any, localizer: any) => localizer!.format(date, 'EEEE', culture)
                }}
                components={{
                    header: CustomWeekHeader,
                    week: {
                        header: CustomWeekHeader
                    },
                    month: {
                        header: CustomMonthHeader
                    },
                    timeSlotWrapper: CustomTimeSlotWrapper
                }}
                dayLayoutAlgorithm="no-overlap"
                step={60}
                eventPropGetter={(event) => {
                    const roomId = event.resource.roomId || 0;
                    const colorIndex = roomId % ROOM_COLORS.length;
                    const isOwn = currentUser && event.resource.userId === currentUser.id;
                    const baseColor = ROOM_COLORS[colorIndex];
                    // For non-owner: use semi-transparent color on white background (prevents color blending when overlapping)
                    // 8C = 140 in decimal = ~55% opacity
                    const bgStyle = isOwn
                        ? baseColor
                        : `linear-gradient(${baseColor}8C, ${baseColor}8C), white`;
                    return {
                        style: {
                            background: bgStyle,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            border: 'none',
                            borderLeft: isOwn ? '5px solid rgba(0,0,0,0.6)' : `3px solid ${baseColor}`,
                            color: 'white',
                            boxShadow: isOwn ? '0 2px 6px rgba(0,0,0,0.25)' : 'none',
                            fontWeight: isOwn ? 'bold' : 'normal',
                            fontSize: '11px',
                            lineHeight: '1.2',
                            padding: '2px 4px',
                            overflow: 'hidden'
                        }
                    };
                }}
            />

            {/* Event Detail Modal */}
            {selectedEvent && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm rounded-2xl animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Booking Details</h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1 block">Topic</label>
                                <p className="text-xl font-bold text-slate-900 leading-tight">{selectedEvent.resource.topic}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Room</label>
                                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                        {selectedEvent.resource.room?.name || 'Unknown'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">User</label>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                        <div className="flex flex-col">
                                            <span className="font-bold">{selectedEvent.resource.user?.name || selectedEvent.resource.user?.username || `ID: ${selectedEvent.resource.userId}`}</span>
                                            {selectedEvent.resource.user?.employeeId && (
                                                <span className="text-xs text-slate-500">{selectedEvent.resource.user.employeeId}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Time Slot</label>
                                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    <span>{format(selectedEvent.start, 'dd MMM yyyy')}</span>
                                    <span className="text-slate-300">|</span>
                                    <span>{format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}</span>
                                </div>
                            </div>

                            {/* Recurring Info */}
                            {selectedEvent.resource.recurringType && selectedEvent.resource.recurringType !== 'none' && (
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                                    <label className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1 block">🔁 Repeat</label>
                                    <div className="flex items-center gap-2 text-amber-800 font-semibold">
                                        <span>
                                            {selectedEvent.resource.recurringType === 'daily' && 'Every Day'}
                                            {selectedEvent.resource.recurringType === 'weekly' && 'Every Week'}
                                            {selectedEvent.resource.recurringType === 'monthly' && 'Every Month'}
                                        </span>
                                        {selectedEvent.resource.recurringEndDate && (
                                            <>
                                                <span className="text-amber-400">→</span>
                                                <span>Until {format(new Date(selectedEvent.resource.recurringEndDate), 'dd MMM yyyy')}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                {new Date(selectedEvent.start) < new Date(new Date().setHours(0, 0, 0, 0)) ? (
                                    <div className="flex-1 text-center py-2.5 px-4 bg-slate-100 text-slate-500 font-medium rounded-xl border border-slate-200">
                                        Past bookings cannot be modified
                                    </div>
                                ) : (
                                    (currentUser?.role === 'ADMIN' || currentUser?.id === selectedEvent.resource.userId) && (
                                        <>
                                            <button
                                                onClick={() => setShowEditModal(true)}
                                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleCancelBooking(selectedEvent.resource.id)}
                                                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )
                                )}
                                <button
                                    onClick={closeModal}
                                    className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEditModal && selectedEvent && (
                <BookingModal
                    roomId={selectedEvent.resource.roomId}
                    roomName={selectedEvent.resource.room?.name || 'Meeting Room'}
                    initialData={selectedEvent.resource}
                    minHour={startHour}
                    maxHour={endHour}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => {
                        setShowEditModal(false);
                        setSelectedEvent(null);
                        fetchBookings();
                        Swal.fire({ title: 'Updated!', text: 'Booking details updated.', icon: 'success', timer: 800, showConfirmButton: false });
                    }}
                />
            )}

            {showCreateModal && (
                <BookingModal
                    roomId={createData?.roomId || rooms[0]?.id}
                    roomName={rooms.find(r => r.id === (createData?.roomId || rooms[0]?.id))?.name || 'Meeting Room'}
                    initialData={createData}
                    minHour={startHour}
                    maxHour={endHour}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        setCreateData(null);
                        fetchBookings();
                    }}
                />
            )}
        </div>
    );
}
