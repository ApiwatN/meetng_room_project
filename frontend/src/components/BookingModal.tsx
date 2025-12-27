import React, { useState, useEffect } from 'react';
import config from '@/config';
import BookingSuccessModal from './BookingSuccessModal';
import { format } from 'date-fns';
import Swal from 'sweetalert2';

// Generate time options (00:00 - 23:45)
const TIME_OPTIONS = Array.from({ length: 96 }).map((_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
});

interface BookingModalProps {
    roomId: number;
    roomName: string;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
    minHour?: number;
    maxHour?: number;
}

export default function BookingModal({ roomId, roomName, onClose, onSuccess, initialData, minHour, maxHour }: BookingModalProps) {
    const [topic, setTopic] = useState(initialData?.topic || '');
    const [startTime, setStartTime] = useState(initialData?.startTime ? format(new Date(initialData.startTime), "yyyy-MM-dd'T'HH:mm") : '');
    const [endTime, setEndTime] = useState(initialData?.endTime ? format(new Date(initialData.endTime), "yyyy-MM-dd'T'HH:mm") : '');
    const [recurringType, setRecurringType] = useState(initialData?.recurringType || 'none');
    const [recurringEndDate, setRecurringEndDate] = useState(initialData?.recurringEndDate ? format(new Date(initialData.recurringEndDate), "yyyy-MM-dd") : '');
    const [isPrivate, setIsPrivate] = useState(initialData?.isPrivate || false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successData, setSuccessData] = useState<any | null>(null);
    const [existingBookings, setExistingBookings] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<number>(initialData?.roomId || roomId);
    const [updateMode, setUpdateMode] = useState<'single' | 'series'>('single');

    useEffect(() => {
        const fetchRooms = async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`${config.apiServer}/api/rooms`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setRooms(data);
                }
            } catch (error) {
                console.error('Failed to fetch rooms', error);
            }
        };
        fetchRooms();
    }, []);

    useEffect(() => {
        const fetchBookings = async () => {
            const token = localStorage.getItem('token');
            // Use selectedRoomId if available, otherwise fallback to prop roomId (though selectedRoomId should always be set)
            const targetRoomId = selectedRoomId || roomId;
            try {
                // Fetch all bookings for this room to check availability
                const res = await fetch(`${config.apiServer}/api/bookings/room/${targetRoomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setExistingBookings(data);
                }
            } catch (error) {
                console.error('Failed to fetch room bookings', error);
            }
        };
        if (selectedRoomId || roomId) {
            fetchBookings();
        }
    }, [selectedRoomId, roomId]);

    // Auto-fill nearest available time slot when no initialData provided
    useEffect(() => {
        // Skip if editing existing booking or if times already set
        if (initialData?.id || startTime) return;

        const findNearestAvailableSlot = () => {
            const now = new Date();
            // Round up to next 15-minute interval
            const minutes = now.getMinutes();
            const roundedMinutes = Math.ceil(minutes / 15) * 15;
            now.setMinutes(roundedMinutes, 0, 0);

            // Try to find 1-hour slot within the next 24 hours
            for (let i = 0; i < 96; i++) { // 96 x 15 min = 24 hours
                const slotStart = new Date(now.getTime() + i * 15 * 60 * 1000);
                const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // +1 hour

                // Check if within operating hours (default 7-18)
                const startHour = slotStart.getHours();
                const endHour = slotEnd.getHours();
                const min = minHour ?? 7;
                const max = maxHour ?? 18;

                if (startHour < min || startHour >= max) continue;
                if (endHour > max) {
                    // Try shorter slot ending at max hour
                    slotEnd.setHours(max, 0, 0, 0);
                    if (slotEnd <= slotStart) continue;
                }

                // Check for conflicts with existing bookings
                const hasConflict = existingBookings.some((b: any) => {
                    const bStart = new Date(b.startTime);
                    const bEnd = new Date(b.endTime);
                    return slotStart < bEnd && slotEnd > bStart;
                });

                if (!hasConflict) {
                    // Found available slot
                    setStartTime(format(slotStart, "yyyy-MM-dd'T'HH:mm"));
                    setEndTime(format(slotEnd, "yyyy-MM-dd'T'HH:mm"));
                    return;
                }
            }
        };

        // Only run when bookings are loaded
        if (existingBookings !== undefined) {
            findNearestAvailableSlot();
        }
    }, [existingBookings, initialData, startTime, minHour, maxHour]);

    const isTimeDisabled = (timeStr: string, isStart: boolean) => {
        if (!existingBookings.length) return false;

        // Determine the date to check against
        const datePart = isStart ? startTime.split('T')[0] : endTime.split('T')[0];
        if (!datePart) return false;

        const targetDateTime = new Date(`${datePart}T${timeStr}`);

        // Filter out current booking (for Edit mode)
        const relevantBookings = existingBookings.filter((b: any) =>
            !initialData || b.id !== initialData.id
        );

        // Check 1: Is the specific time slot inside an existing booking?
        const isInside = relevantBookings.some((b: any) => {
            const bStart = new Date(b.startTime);
            const bEnd = new Date(b.endTime);

            // Start Time: Disabled if t >= Start && t < End
            if (isStart) {
                return targetDateTime >= bStart && targetDateTime < bEnd;
            }
            // End Time: Disabled if t > Start && t <= End
            else {
                return targetDateTime > bStart && targetDateTime <= bEnd;
            }
        });

        if (isInside) return true;

        // Check 2: Range Overlap Prevention (Specifically for End Time)
        // Ensure we don't extend the booking OVER another existing booking
        if (!isStart) {
            const currentStartStr = startTime;
            if (!currentStartStr) return false;

            const currentStart = new Date(currentStartStr);

            // Find the closest future booking that starts AFTER our selected Start Time
            const nextBooking = relevantBookings
                .map((b: any) => ({ ...b, startObj: new Date(b.startTime) }))
                .filter((b: any) => b.startObj >= currentStart)
                .sort((a: any, b: any) => a.startObj.getTime() - b.startObj.getTime())[0];

            if (nextBooking) {
                // If this End Time is AFTER the start of the next booking, disable it
                // (We can't bridge over an existing booking)
                if (targetDateTime > nextBooking.startObj) {
                    return true;
                }
            }
        }

        return false;
    };

    const handleSubmit = async (e: React.FormEvent, skipConfirmation = false) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const userStr = localStorage.getItem('user');
        if (!userStr) {
            setError('User not found. Please log in.');
            setLoading(false);
            return;
        }
        const user = JSON.parse(userStr);
        const token = localStorage.getItem('token');

        try {
            const start = new Date(startTime).toISOString();
            const end = new Date(endTime).toISOString();

            if (new Date(start) >= new Date(end)) {
                throw new Error('End time must be after start time');
            }

            const diffMs = new Date(end).getTime() - new Date(start).getTime();
            const diffMinutes = diffMs / (1000 * 60);
            if (diffMinutes < 15) {
                throw new Error('Meeting duration must be at least 15 minutes');
            }

            const isRecurring = recurringType && recurringType !== 'none';
            const isNewBooking = !initialData?.id;

            // Confirmation for new bookings (if not already confirmed)
            if (isNewBooking && !skipConfirmation) {
                setLoading(false);
                const roomNameStr = rooms.find(r => r.id === Number(selectedRoomId))?.name || roomName;
                const startDate = new Date(start);
                const endDate = new Date(end);
                const dateStr = `${startDate.getDate().toString().padStart(2, '0')}/${startDate.toLocaleString('en-US', { month: 'short' })}/${startDate.getFullYear()}`;
                const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

                const confirmResult = await Swal.fire({
                    title: 'Confirm Booking?',
                    html: `<div class="text-left text-sm">
                        <p><strong>Room:</strong> ${roomNameStr}</p>
                        <p><strong>Topic:</strong> ${topic}</p>
                        <p><strong>Date:</strong> ${dateStr}</p>
                        <p><strong>Time:</strong> ${timeStr}</p>
                        ${isRecurring ? `<p><strong>Repeat:</strong> ${recurringType === 'daily' ? 'Daily' : recurringType === 'weekly' ? 'Weekly' : recurringType}</p>` : ''}
                    </div>`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#4F46E5',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Confirm Booking',
                    cancelButtonText: 'Cancel'
                });

                if (!confirmResult.isConfirmed) {
                    return;
                }
                setLoading(true);
            }

            // Confirmation for editing bookings
            if (!isNewBooking && !skipConfirmation) {
                setLoading(false);
                const roomNameStr = rooms.find(r => r.id === Number(selectedRoomId))?.name || roomName;
                const startDate = new Date(start);
                const endDate = new Date(end);
                const dateStr = `${startDate.getDate().toString().padStart(2, '0')}/${startDate.toLocaleString('en-US', { month: 'short' })}/${startDate.getFullYear()}`;
                const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

                const confirmResult = await Swal.fire({
                    title: 'Confirm Update?',
                    html: `<div class="text-left text-sm">
                        <p><strong>Room:</strong> ${roomNameStr}</p>
                        <p><strong>Topic:</strong> ${topic}</p>
                        <p><strong>Date:</strong> ${dateStr}</p>
                        <p><strong>Time:</strong> ${timeStr}</p>
                    </div>`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#4F46E5',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Update Booking',
                    cancelButtonText: 'Cancel'
                });

                if (!confirmResult.isConfirmed) {
                    return;
                }
                setLoading(true);
            }

            // For recurring bookings (new), first do a dry run to check for conflicts
            if (isRecurring && isNewBooking && !skipConfirmation) {
                const previewRes = await fetch(`${config.apiServer}/api/bookings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        roomId: selectedRoomId,
                        userId: user.id,
                        startTime: start,
                        endTime: end,
                        topic,
                        isPrivate,
                        recurringType,
                        recurringEndDate,
                        dryRun: true // Preview mode
                    })
                });

                const previewData = await previewRes.json();

                if (!previewRes.ok) {
                    throw new Error(previewData.error || 'Preview failed');
                }

                // If there are skipped dates, show confirmation
                if (previewData.preview && previewData.skippedCount > 0) {
                    setLoading(false);
                    const result = await Swal.fire({
                        title: 'Some dates are unavailable',
                        html: `<div class="text-left">
                            <p>Total: <strong>${previewData.totalSlots}</strong> days</p>
                            <p class="text-green-600">✓ Available: <strong>${previewData.availableCount}</strong> days</p>
                            <p class="text-orange-500">⊘ Skipped: <strong>${previewData.skippedCount}</strong> days</p>
                            <p class="text-xs text-slate-500 mt-2">Skipped dates: ${previewData.skippedDates.slice(0, 5).join(', ')}${previewData.skippedDates.length > 5 ? ` +${previewData.skippedDates.length - 5} more` : ''}</p>
                        </div>`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#4F46E5',
                        cancelButtonColor: '#d33',
                        confirmButtonText: `Confirm Booking ${previewData.availableCount} days`,
                        cancelButtonText: 'Cancel'
                    });

                    if (!result.isConfirmed) {
                        return; // User cancelled
                    }

                    // User confirmed, proceed with actual booking
                    setLoading(true);
                    return handleSubmit(e, true); // Recursive call with skipConfirmation=true
                }
            }

            // Actual booking request
            const url = initialData?.id
                ? `${config.apiServer}/api/bookings/${initialData.id}`
                : `${config.apiServer}/api/bookings`;

            const method = initialData?.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    roomId: selectedRoomId,
                    userId: user.id,
                    startTime: start,
                    endTime: end,
                    topic,
                    isPrivate,
                    recurringType,
                    recurringEndDate,
                    updateMode: initialData?.id ? updateMode : undefined
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Booking failed');
            }

            // For update, show success notification and close. For create, show success modal.
            if (initialData?.id) {
                await Swal.fire({
                    title: 'Success!',
                    text: 'Booking updated successfully',
                    icon: 'success',
                    timer: 800,
                    showConfirmButton: false
                });
                onSuccess();
            } else {
                // Show success alert for new booking
                await Swal.fire({
                    title: 'Success!',
                    text: 'Booking created successfully',
                    icon: 'success',
                    timer: 800,
                    showConfirmButton: false
                });
                onSuccess();
                onClose();
            }

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    if (successData) {
        return (
            <BookingSuccessModal
                booking={successData}
                onClose={onClose}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800">{initialData?.id ? 'Edit Booking' : 'Book Room'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-all bg-white hover:bg-slate-100 rounded-full p-2 border border-slate-200 active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 ml-1">Room</label>
                            <select
                                value={selectedRoomId}
                                onChange={(e) => setSelectedRoomId(Number(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                            >
                                {rooms.map(room => (
                                    <option key={room.id} value={room.id}>{room.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 ml-1">Meeting Topic</label>
                            <input
                                type="text"
                                required
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                placeholder="Type a topic..."
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 ml-1">Start Time</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    required
                                    value={startTime.split('T')[0] || ''}
                                    onChange={(e) => setStartTime(`${e.target.value}T${startTime.split('T')[1] || '09:00'}`)}
                                    className="w-3/5 bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                                />
                                <select
                                    required
                                    value={startTime.split('T')[1] || ''}
                                    onChange={(e) => setStartTime(`${startTime.split('T')[0]}T${e.target.value}`)}
                                    className="w-2/5 bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                                >
                                    <option value="" disabled>Select Time</option>
                                    {TIME_OPTIONS.filter(t => {
                                        const h = parseInt(t.split(':')[0]);
                                        const min = minHour ?? 0;
                                        const max = maxHour ?? 24;
                                        // Start time must be >= min and < max (assuming max is exclusive end of operation)
                                        return h >= min && h < max;
                                    }).map(t => {
                                        const disabled = isTimeDisabled(t, true);
                                        return (
                                            <option key={`start-${t}`} value={t} disabled={disabled}>
                                                {t} {disabled ? '(Booked)' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5 ml-1">End Time</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    required
                                    value={endTime.split('T')[0] || ''}
                                    onChange={(e) => setEndTime(`${e.target.value}T${endTime.split('T')[1] || '10:00'}`)}
                                    className="w-3/5 bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                                />
                                <select
                                    required
                                    value={endTime.split('T')[1] || ''}
                                    onChange={(e) => setEndTime(`${endTime.split('T')[0]}T${e.target.value}`)}
                                    className="w-2/5 bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                                >
                                    <option value="" disabled>Select Time</option>
                                    {TIME_OPTIONS.filter(t => {
                                        const h = parseInt(t.split(':')[0]);
                                        const m = parseInt(t.split(':')[1]);
                                        const min = minHour ?? 0;
                                        const max = maxHour ?? 24;

                                        // End time must be >= min and <= max (can end exactly at closing time)
                                        // Also strict check: if h === max, m must be 00 (unless we allow overtime)
                                        if (h === max && m > 0) return false;

                                        return h >= min && h <= max;
                                    }).map(t => {
                                        // Check if end time is at least 15 minutes after start time
                                        const startTimeParts = startTime.split('T');
                                        let isBeforeStart = false;
                                        if (startTimeParts[0] && startTimeParts[1]) {
                                            const startDateTime = new Date(`${startTimeParts[0]}T${startTimeParts[1]}`);
                                            const endDateTime = new Date(`${endTime.split('T')[0] || startTimeParts[0]}T${t}`);
                                            const diffMs = endDateTime.getTime() - startDateTime.getTime();
                                            const diffMinutes = diffMs / (1000 * 60);
                                            // Disable if end time is <= start time or less than 15 minutes after
                                            isBeforeStart = diffMinutes < 15;
                                        }

                                        const disabled = isTimeDisabled(t, false) || isBeforeStart;
                                        return (
                                            <option key={`end-${t}`} value={t} disabled={disabled}>
                                                {t} {isBeforeStart ? '(< 15 min)' : disabled ? '(Booked)' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Recurring Options */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <label className="text-sm font-semibold text-slate-700 block mb-1.5 ml-1">Repeat</label>
                                <select
                                    value={recurringType}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setRecurringType(val);
                                        if (val === 'none') {
                                            setRecurringEndDate('');
                                        }
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm"
                                >
                                    <option value="none">Does not repeat</option>
                                    <option value="daily">Every Day</option>
                                    <option value="weekly">Every Week</option>
                                    <option value="monthly">Every Month</option>
                                </select>
                            </div>
                            <div>
                                <label className={`text-sm font-semibold block mb-1.5 ml-1 ${recurringType === 'none' ? 'text-slate-300' : 'text-slate-700'}`}>Until</label>
                                <input
                                    type="date"
                                    value={recurringEndDate}
                                    onChange={(e) => setRecurringEndDate(e.target.value)}
                                    min={startTime ? new Date(startTime).toISOString().split('T')[0] : undefined}
                                    disabled={recurringType === 'none'}
                                    className={`w-full bg-white border rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm ${recurringType === 'none' ? 'border-slate-200 text-slate-300 bg-slate-50' : 'border-slate-300'}`}
                                    required={recurringType !== 'none'}
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="private"
                                    checked={isPrivate}
                                    onChange={(e) => setIsPrivate(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-offset-white focus:ring-blue-500 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <label htmlFor="private" className="text-sm font-semibold text-slate-700 cursor-pointer select-none block">
                                        Private Booking
                                    </label>
                                    <p className="text-xs text-slate-500">Details hidden from others.</p>
                                </div>
                            </div>
                        </div>

                        {/* Series Update Mode - Only show when editing a grouped booking */}
                        {initialData?.id && initialData?.groupId && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <p className="text-sm font-semibold text-amber-800 mb-3">🔁 This is a recurring event</p>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="updateMode"
                                            value="single"
                                            checked={updateMode === 'single'}
                                            onChange={() => setUpdateMode('single')}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-700">Edit only this event</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="updateMode"
                                            value="series"
                                            checked={updateMode === 'series'}
                                            onChange={() => setUpdateMode('series')}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-700">Edit entire series (all future events)</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium text-sm active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Processing...' : (initialData ? 'Save Changes' : 'Confirm Request')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
