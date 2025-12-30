import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import config from '@/config';
import Swal from 'sweetalert2';
import BookingModal from './BookingModal';
import { format } from 'date-fns';
import { formatDate, formatTime, formatTimeRange } from '@/utils/dateUtils';
import { io } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

interface Room {
    id: number;
    name: string;
    bookings?: Array<{
        id: number;
        startTime: string;
        endTime: string;
        topic: string;
        isPrivate: boolean;
        userId: number;
        roomId: number;
        groupId?: string;
        user: { id: number; username: string; employeeId?: string; section?: string; phoneNumber?: string };
    }>;
}

interface TimelineProps {
    rooms: Room[];
    onRefresh?: () => void;
    isGuest?: boolean;
}

// Room Colors Palette (same as AdminCalendar)
const ROOM_COLORS = [
    '#4f46e5', // Indigo
    '#059669', // Emerald
    '#d97706', // Amber
    '#e11d48', // Rose
    '#0891b2', // Cyan
    '#7c3aed', // Violet
    '#db2777', // Pink
    '#65a30d', // Lime
];

export default function Timeline({ rooms, onRefresh, isGuest = false }: TimelineProps) {
    const router = useRouter();
    const [startHour, setStartHour] = useState<number>(7);
    const [endHour, setEndHour] = useState<number>(18);
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const { user: currentUser } = useAuth();
    const [allBookings, setAllBookings] = useState<any[]>([]);

    // Modal states
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<any | null>(null);
    const [defaultStartTime, setDefaultStartTime] = useState<Date | null>(null);
    const [defaultEndTime, setDefaultEndTime] = useState<Date | null>(null);
    const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<any | null>(null);
    const [selectedRoomForDetails, setSelectedRoomForDetails] = useState<Room | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [showRangeControls, setShowRangeControls] = useState(false);

    // Hover state for timeline
    const [hoveredSlot, setHoveredSlot] = useState<{
        roomId: number;
        left: number;
        width: number;
        timeLabel: string;
    } | null>(null);
    const requestRef = React.useRef<number | null>(null);

    // Check if selected date is today
    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    const fetchAllBookings = React.useCallback(async () => {
        if (!selectedDate) return;
        try {
            // Calculate range: 00:00 to 23:59 of selectedDate
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);

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
                setAllBookings(data);
            }
        } catch (error) {
            console.error('Failed to fetch bookings', error);
        }
    }, [selectedDate]);

    // Fetch when selectedDate changes
    useEffect(() => {
        fetchAllBookings();
    }, [fetchAllBookings]);

    // Socket.io for realtime updates
    useEffect(() => {
        const socket = io(config.apiServer);
        socket.on('booking_created', fetchAllBookings);
        socket.on('booking_updated', fetchAllBookings);
        socket.on('booking_deleted', fetchAllBookings);
        socket.on('room_update', fetchAllBookings);

        return () => {
            socket.disconnect();
        };
    }, [fetchAllBookings]);

    // Initialize client-side values after mount
    useEffect(() => {
        setIsClient(true);
        // setSelectedDate initialized in state directly to avoid empty string render


        const savedStart = localStorage.getItem('timeline_startHour');
        const savedEnd = localStorage.getItem('timeline_endHour');
        if (savedStart) setStartHour(Number(savedStart));
        if (savedEnd) setEndHour(Number(savedEnd));
    }, []);

    // Save to localStorage when range changes
    useEffect(() => {
        if (isClient) {
            localStorage.setItem('timeline_startHour', startHour.toString());
        }
    }, [startHour, isClient]);

    useEffect(() => {
        if (isClient) {
            localStorage.setItem('timeline_endHour', endHour.toString());
        }
    }, [endHour, isClient]);

    // Update current time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000); // Update every second
        return () => clearInterval(interval);
    }, []);

    // Generate half-hour time labels
    const timeLabels: { hour: number; minute: number; label: string }[] = [];
    for (let h = startHour; h <= endHour; h++) {
        timeLabels.push({ hour: h, minute: 0, label: `${h}:00` });
        if (h < endHour) {
            timeLabels.push({ hour: h, minute: 30, label: `${h}:30` });
        }
    }

    const totalMinutes = (endHour - startHour) * 60;

    const getPosition = (isoDate: string) => {
        const date = new Date(isoDate);
        const h = date.getHours();
        const m = date.getMinutes();
        const minutesFromStart = (h - startHour) * 60 + m;
        if (minutesFromStart < 0) return 0;
        if (minutesFromStart > totalMinutes) return 100;
        return (minutesFromStart / totalMinutes) * 100;
    };

    const getWidth = (startIso: string, endIso: string) => {
        const start = getPosition(startIso);
        const end = getPosition(endIso);
        return Math.max(end - start, 0.5);
    };

    const handleStartHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        if (val < endHour) setStartHour(val);
    };

    const handleEndHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        if (val > startHour) setEndHour(val);
    };

    const handleBookingClick = (booking: any, room: Room) => {
        setSelectedBookingForDetails(booking);
        setSelectedRoomForDetails(room);
    };

    const closeDetailsModal = () => {
        setSelectedBookingForDetails(null);
        setSelectedRoomForDetails(null);
    };

    const handleDeleteBooking = async (bookingId: number, groupId?: string, deleteAll?: boolean) => {
        // Show confirmation dialog
        const result = await Swal.fire({
            title: 'Cancel Booking?',
            text: 'Are you sure you want to cancel this booking?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, cancel it',
            cancelButtonText: 'No, keep it'
        });

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        try {
            let response;
            if (deleteAll && groupId) {
                response = await fetch(`${config.apiServer}/api/bookings/cancel-series/${groupId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                response = await fetch(`${config.apiServer}/api/bookings/${bookingId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }

            if (response.ok) {
                closeDetailsModal();
                await Swal.fire({ title: 'Success!', icon: 'success', timer: 800, showConfirmButton: false });
                fetchAllBookings();
                onRefresh?.();
            } else {
                const errorData = await response.json();
                Swal.fire('Failed', errorData.error || 'Unable to cancel', 'error');
            }
        } catch (error) {
            console.error('Cancel error:', error);
            Swal.fire('Failed', 'Unable to cancel', 'error');
        }
    };

    const handleEditFromDetails = () => {
        if (selectedBookingForDetails && selectedRoomForDetails) {
            setSelectedRoom(selectedRoomForDetails);
            setSelectedBookingForEdit(selectedBookingForDetails);
            setDefaultStartTime(null);
            closeDetailsModal();
            setShowBookingModal(true);
        }
    };

    const getRoomColor = (roomId: number) => {
        return ROOM_COLORS[roomId % ROOM_COLORS.length];
    };

    // Filter bookings by selected date
    const isBookingOnDate = (booking: any) => {
        const bookingDate = new Date(booking.startTime).toISOString().split('T')[0];
        return bookingDate === selectedDate;
    };

    // Get rooms with filtered bookings from allBookings (not from rooms.bookings prop)
    const filteredRooms = rooms.map(room => ({
        ...room,
        bookings: allBookings.filter(b => b.roomId === room.id && isBookingOnDate(b))
    }));

    // Click on empty timeline slot to create booking
    const handleTimelineClick = async (e: React.MouseEvent<HTMLDivElement>, room: Room) => {
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

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;

        // Calculate time from click position (round to nearest 15 min)
        const minutesFromStart = percentage * totalMinutes;
        const clickHour = Math.floor(minutesFromStart / 60) + startHour;
        const clickMinute = Math.floor((minutesFromStart % 60) / 15) * 15; // Round down to nearest 15 min (start of slot)

        // Create start time for selected date
        let clickedStartTime = new Date(selectedDate);
        clickedStartTime.setHours(clickHour, clickMinute >= 60 ? 0 : clickMinute, 0, 0);
        if (clickMinute >= 60) clickedStartTime.setHours(clickedStartTime.getHours() + 1);

        // Find room's bookings for this date
        const roomBookings = allBookings.filter(b => {
            if (b.roomId !== room.id) return false;
            const bookingDate = new Date(b.startTime).toISOString().split('T')[0];
            return bookingDate === selectedDate;
        }).map(b => ({
            ...b,
            startObj: new Date(b.startTime),
            endObj: new Date(b.endTime)
        })).sort((a, b) => a.startObj.getTime() - b.startObj.getTime());

        // Check if clicked time is inside an existing booking
        const clickedBooking = roomBookings.find(b =>
            clickedStartTime >= b.startObj && clickedStartTime < b.endObj
        );

        // If clicked on booking, find the next available slot (after this booking ends)
        if (clickedBooking) {
            clickedStartTime = new Date(clickedBooking.endObj);
        }

        // Find the closest booking that starts after our start time
        const nextBooking = roomBookings.find(b => b.startObj > clickedStartTime);

        // Default end time is 1 hour later
        let endTime = new Date(clickedStartTime.getTime() + 60 * 60 * 1000);

        // If next booking would overlap with our default 1hr slot, limit end time
        if (nextBooking && nextBooking.startObj < endTime) {
            endTime = nextBooking.startObj;
        }

        // Check if end time is same or before start time (no available slot)
        if (endTime <= clickedStartTime) {
            return; // No available time slot
        }

        // Check if we're past the end hour limit
        if (clickedStartTime.getHours() >= endHour) {
            return; // Past visible range
        }

        setSelectedRoom(room);
        setSelectedBookingForEdit(null);
        setDefaultStartTime(clickedStartTime);
        setDefaultEndTime(endTime);
        setShowBookingModal(true);
    };

    // Handle booking click for edit
    const handleBookingClickForEdit = (booking: any, room: Room) => {
        const isOwner = currentUser && booking.userId === currentUser.id;
        const isAdmin = currentUser?.role === 'ADMIN';
        if (!isOwner && !isAdmin) return;

        setSelectedRoom(room);
        setSelectedBookingForEdit(booking);
        setDefaultStartTime(null);
        setShowBookingModal(true);
    };

    const handleBookingComplete = () => {
        setShowBookingModal(false);
        setSelectedRoom(null);
        setSelectedBookingForEdit(null);
        setDefaultStartTime(null);
        setDefaultEndTime(null);
        fetchAllBookings();
        onRefresh?.();
    };

    const handleMouseLeave = () => {
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
        setHoveredSlot(null);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, roomId: number) => {
        // Use requestAnimationFrame for performance
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        requestRef.current = requestAnimationFrame(() => {
            // Calculate percentage position
            const percentage = Math.max(0, Math.min(100, (x / width) * 100));

            // Calculate time in minutes from startHour
            const totalMinutesInRange = (endHour - startHour) * 60;
            const minutesFromStart = (percentage / 100) * totalMinutesInRange;

            // Snap to 15 minutes
            const snappedMinutes = Math.floor(minutesFromStart / 15) * 15;

            // Calculate snapped percentage
            const snappedPercentage = (snappedMinutes / totalMinutesInRange) * 100;

            // Calculate hovered start time
            const hoveredStartMinutes = startHour * 60 + snappedMinutes;
            const hoveredStartTime = new Date(selectedDate);
            hoveredStartTime.setHours(Math.floor(hoveredStartMinutes / 60), hoveredStartMinutes % 60, 0, 0);

            // Find room's bookings for this date
            const roomBookings = allBookings.filter(b => {
                if (b.roomId !== roomId) return false;
                const bookingDate = new Date(b.startTime).toISOString().split('T')[0];
                return bookingDate === selectedDate;
            }).map(b => ({
                ...b,
                startObj: new Date(b.startTime),
                endObj: new Date(b.endTime)
            })).sort((a, b) => a.startObj.getTime() - b.startObj.getTime());

            // Check if hovered time is inside an existing booking
            const isInsideBooking = roomBookings.some(b =>
                hoveredStartTime >= b.startObj && hoveredStartTime < b.endObj
            );

            // If inside a booking, don't show hover
            if (isInsideBooking) {
                setHoveredSlot(null);
                return;
            }

            // Find next booking that starts after our hovered start time
            const nextBooking = roomBookings.find(b => b.startObj > hoveredStartTime);

            // Default duration: 1 hour (60 minutes)
            let availableMinutes = 60;

            // If there's a next booking, limit to time until that booking
            if (nextBooking) {
                const minutesUntilNext = (nextBooking.startObj.getTime() - hoveredStartTime.getTime()) / (1000 * 60);
                availableMinutes = Math.min(60, minutesUntilNext);
            }

            // Don't show if no available time
            if (availableMinutes <= 0) {
                setHoveredSlot(null);
                return;
            }

            // Calculate width percentage based on available minutes
            const widthPercentage = (availableMinutes / totalMinutesInRange) * 100;

            // Calculate time label
            const hour = Math.floor(hoveredStartMinutes / 60);
            const minute = hoveredStartMinutes % 60;
            const endMinutes = hoveredStartMinutes + availableMinutes;
            const endHourLabel = Math.floor(endMinutes / 60);
            const endMinuteLabel = endMinutes % 60;
            const timeLabel = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} - ${endHourLabel.toString().padStart(2, '0')}:${endMinuteLabel.toString().padStart(2, '0')}`;

            setHoveredSlot({
                roomId,
                left: snappedPercentage,
                width: widthPercentage,
                timeLabel
            });
        });
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-800">
                        Schedule
                    </h3>
                    {selectedDate === new Date().toISOString().split('T')[0] && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Today</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {/* Navigation Buttons */}
                    <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-200 rounded-l-lg transition-all active:scale-95"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() - 1);
                                setSelectedDate(d.toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-200 transition-all active:scale-95 border-l border-slate-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                d.setDate(d.getDate() + 1);
                                setSelectedDate(d.toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-200 rounded-r-lg transition-all active:scale-95 border-l border-slate-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>

                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer font-medium"
                    />

                    {/* Range Controls - Hidden on mobile, shown on md+ or when toggled */}
                    <div className="hidden md:flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                        <span className="text-xs font-semibold text-slate-500 pl-1">Range:</span>
                        <select
                            value={startHour}
                            onChange={handleStartHourChange}
                            className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
                        >
                            {Array.from({ length: 24 }).map((_, i) => (
                                <option key={i} value={i}>{i}:00</option>
                            ))}
                        </select>
                        <span className="text-slate-400">-</span>
                        <select
                            value={endHour}
                            onChange={handleEndHourChange}
                            className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
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
                        title="Adjust time range"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                </div>
            </div>

            {/* Mobile Range Dropdown */}
            {showRangeControls && (
                <div className="md:hidden mb-4 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
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

            <div className="overflow-x-auto pb-2 custom-scrollbar">
                <div className="min-w-[600px] md:min-w-[800px]">
                    {/* Header with half-hour marks */}
                    <div className="flex border-b border-slate-100 pb-4 mb-4">
                        <div className="w-24 md:w-36 shrink-0 text-sm font-bold text-slate-400 pl-2 sticky left-0 bg-white z-10">Room</div>
                        <div className="flex-1 relative h-6">
                            {timeLabels.map((t, idx) => {
                                const position = ((t.hour - startHour) * 60 + t.minute) / totalMinutes * 100;
                                const isHalfHour = t.minute === 30;
                                const isFirst = idx === 0;
                                return (
                                    <div
                                        key={idx}
                                        className={`absolute ${isFirst ? '' : '-translate-x-1/2'} ${isHalfHour ? 'hidden md:block text-[9px] text-slate-300' : 'text-[10px] md:text-xs font-semibold text-slate-400'}`}
                                        style={{ left: `${position}%` }}
                                    >
                                        {t.label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Rows with Current Time Line */}
                    <div className="relative">
                        {/* Current Time Line - spans across all rooms */}
                        {isToday && (() => {
                            const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                            const startMinutes = startHour * 60;
                            const endMinutes = endHour * 60;

                            if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
                                const position = (nowMinutes - startMinutes) / totalMinutes;
                                return (
                                    <div className="absolute inset-0 z-30 pointer-events-none flex items-stretch">
                                        {/* Spacer to match Room column width */}
                                        <div className="w-24 md:w-36 shrink-0 pl-2 pr-1" />
                                        {/* Timeline area matching the grid */}
                                        <div className="flex-1 relative ml-1">
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-red-600 shadow-md shadow-red-500/50 transition-all duration-1000 ease-linear"
                                                style={{ left: `${position * 100}%` }}
                                            >
                                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 rounded-full shadow-sm shadow-red-500/50 ring-1 ring-white" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className="space-y-4">
                            {filteredRooms.map(room => {
                                const roomColor = getRoomColor(room.id);
                                return (
                                    <div key={room.id} className="flex items-start group">
                                        <div className="w-24 md:w-36 shrink-0 font-semibold text-slate-700 pl-2 text-xs md:text-sm flex items-start gap-1 md:gap-2 sticky left-0 bg-white z-20 py-2 pr-1">
                                            <span
                                                className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                                                style={{ backgroundColor: roomColor }}
                                            />
                                            <span className="truncate leading-tight" title={room.name}>{room.name}</span>
                                        </div>
                                        <div
                                            className="flex-1 relative h-10 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors ml-1"
                                            onClick={(e) => handleTimelineClick(e, room)}
                                            onMouseMove={(e) => handleMouseMove(e, room.id)}
                                            onMouseLeave={handleMouseLeave}
                                        >
                                            {/* Hover Indicator */}
                                            {hoveredSlot && hoveredSlot.roomId === room.id && (
                                                <div
                                                    className="absolute top-0 bottom-0 bg-indigo-500/10 border-2 border-dashed border-indigo-400/50 z-0 pointer-events-none transition-all duration-75 ease-out flex items-center justify-start pl-1"
                                                    style={{
                                                        left: `${hoveredSlot.left}%`,
                                                        width: `${hoveredSlot.width}%`
                                                    }}
                                                >
                                                    <span className="text-[10px] font-bold text-indigo-600 bg-white/80 px-1 rounded shadow-sm backdrop-blur-sm">
                                                        {hoveredSlot.timeLabel}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Grid Lines - every 30 min */}
                                            {timeLabels.map((t, idx) => {
                                                const position = ((t.hour - startHour) * 60 + t.minute) / totalMinutes * 100;
                                                const isHalfHour = t.minute === 30;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`absolute top-0 bottom-0 ${isHalfHour ? 'border-l border-slate-100' : 'border-l border-slate-200'}`}
                                                        style={{ left: `${position}%` }}
                                                    />
                                                );
                                            })}

                                            {/* Bookings */}
                                            {room.bookings?.map((booking: any, i) => {
                                                const left = getPosition(booking.startTime);
                                                const width = getWidth(booking.startTime, booking.endTime);
                                                if (width <= 0) return null;

                                                const isOwner = currentUser && booking.userId === currentUser.id;
                                                const isAdmin = currentUser?.role === 'ADMIN';
                                                const canModify = isOwner || isAdmin;

                                                const displayTopic = booking.isPrivate && !isAdmin && !isOwner
                                                    ? 'Confidential'
                                                    : booking.topic;

                                                const hoverTitle = `Booked by: ${booking.user.employeeId || booking.user.username}\nSection: ${booking.user.section || 'N/A'}\nTopic: ${displayTopic}\nTime: ${new Date(booking.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - ${new Date(booking.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;

                                                return (
                                                    <div
                                                        key={i}
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent triggering timeline click
                                                            handleBookingClick(booking, room);
                                                        }}
                                                        className={`absolute top-1 bottom-1 rounded transition-all z-10 flex items-center px-1.5 text-white
                                                        ${canModify ? 'cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95' : 'cursor-default'}
                                                    `}
                                                        style={{
                                                            left: `${Math.max(0, left)}%`,
                                                            width: `${width}%`,
                                                            backgroundColor: roomColor,
                                                            opacity: isOwner ? 1 : 0.55,
                                                            border: isOwner ? '2px solid rgba(0,0,0,0.3)' : '1px solid rgba(255,255,255,0.3)',
                                                            fontWeight: isOwner ? 'bold' : 'normal'
                                                        }}
                                                        title={hoverTitle}
                                                    >
                                                        <div className="truncate w-full">
                                                            <span className="text-[10px] font-bold block leading-tight truncate">
                                                                {booking.user?.employeeId || booking.user?.username}
                                                            </span>
                                                            <span className="text-[9px] opacity-90 font-medium truncate block leading-tight">
                                                                {displayTopic}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Modal */}
            {showBookingModal && selectedRoom && (
                <BookingModal
                    roomId={selectedRoom.id}
                    roomName={selectedRoom.name}
                    onClose={() => {
                        setShowBookingModal(false);
                        setSelectedRoom(null);
                        setSelectedBookingForEdit(null);
                        setDefaultStartTime(null);
                        setDefaultEndTime(null);
                    }}
                    onSuccess={handleBookingComplete}
                    initialData={selectedBookingForEdit || (defaultStartTime ? {
                        startTime: defaultStartTime.toISOString(),
                        endTime: (defaultEndTime || new Date(defaultStartTime.getTime() + 60 * 60 * 1000)).toISOString(),
                        roomId: selectedRoom.id
                    } : undefined)}
                    minHour={startHour}
                    maxHour={endHour}
                />
            )}

            {/* Booking Details Modal */}
            {selectedBookingForDetails && selectedRoomForDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Booking Details</h3>
                            <button onClick={closeDetailsModal} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1 block">Topic</label>
                                <p className="text-xl font-bold text-slate-900 leading-tight">
                                    {selectedBookingForDetails.isPrivate && currentUser?.role !== 'ADMIN' && currentUser?.id !== selectedBookingForDetails.userId
                                        ? 'Confidential'
                                        : selectedBookingForDetails.topic}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Room</label>
                                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                        {selectedRoomForDetails.name}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">User</label>
                                    <div className="flex flex-col text-slate-700">
                                        <span className="font-bold">{selectedBookingForDetails.user?.name || selectedBookingForDetails.user?.username || `ID: ${selectedBookingForDetails.userId}`}</span>
                                        {selectedBookingForDetails.user?.employeeId && (
                                            <span className="text-xs text-slate-500">{selectedBookingForDetails.user.employeeId}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Time Slot</label>
                                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    <span>{formatDate(selectedBookingForDetails.startTime)}</span>
                                    <span className="text-slate-300">|</span>
                                    <span>{formatTimeRange(selectedBookingForDetails.startTime, selectedBookingForDetails.endTime)}</span>
                                </div>
                            </div>

                            {/* Recurring Info */}
                            {selectedBookingForDetails.recurringType && selectedBookingForDetails.recurringType !== 'none' && (
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                                    <label className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1 block">🔁 Repeat</label>
                                    <div className="flex items-center gap-2 text-amber-800 font-semibold">
                                        <span>
                                            {selectedBookingForDetails.recurringType === 'daily' && 'Every Day'}
                                            {selectedBookingForDetails.recurringType === 'weekly' && 'Every Week'}
                                            {selectedBookingForDetails.recurringType === 'monthly' && 'Every Month'}
                                        </span>
                                        {selectedBookingForDetails.recurringEndDate && (
                                            <>
                                                <span className="text-amber-400">→</span>
                                                <span>Until {formatDate(selectedBookingForDetails.recurringEndDate)}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                {new Date(selectedBookingForDetails.startTime) < new Date(new Date().setHours(0, 0, 0, 0)) ? (
                                    <div className="flex-1 text-center py-2.5 px-4 bg-slate-100 text-slate-500 font-medium rounded-xl border border-slate-200">
                                        Past bookings cannot be modified
                                    </div>
                                ) : (
                                    (currentUser?.role === 'ADMIN' || currentUser?.id === selectedBookingForDetails.userId) && (
                                        <>
                                            <button
                                                onClick={handleEditFromDetails}
                                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm active:scale-95"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBooking(selectedBookingForDetails.id, selectedBookingForDetails.groupId)}
                                                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm active:scale-95"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )
                                )}
                                <button
                                    onClick={closeDetailsModal}
                                    className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm active:scale-95"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
