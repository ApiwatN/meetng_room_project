import React, { useState, useEffect } from 'react';
import config from '@/config';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import { formatDate, formatTimeRange } from '@/utils/dateUtils';

interface Booking {
    id: number;
    topic: string;
    startTime: string;
    endTime: string;
    room: { name: string };
    groupId?: string;
    recurringType?: string;
}

interface MyBookingsModalProps {
    onClose: () => void;
    onBookingCancelled?: () => void;
}

export default function MyBookingsModal({ onClose, onBookingCancelled }: MyBookingsModalProps) {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMyBookings = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${config.apiServer}/api/bookings/my`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setBookings(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyBookings();
        const socket = io(config.apiServer);
        socket.on('booking_created', fetchMyBookings);
        socket.on('booking_updated', fetchMyBookings);
        return () => { socket.disconnect(); };
    }, []);

    // Group by groupId (or fallback key for old bookings without groupId)
    const getDisplayBookings = () => {
        const now = new Date();
        const futureBookings = bookings.filter(b => new Date(b.startTime) >= now);

        // Group by groupId, or create fallback key from topic+room+recurringType
        const groups = new Map<string, Booking[]>();
        const singles: Booking[] = [];

        futureBookings.forEach(b => {
            // Use groupId if available, otherwise create fallback key for recurring bookings
            const groupKey = b.groupId ||
                (b.recurringType && b.recurringType !== 'none'
                    ? `fallback-${b.topic}-${b.room.name}-${b.recurringType}`
                    : null);

            if (groupKey) {
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, []);
                }
                groups.get(groupKey)!.push(b);
            } else {
                singles.push(b);
            }
        });

        // For each group, get the nearest (first) booking
        const groupedBookings: (Booking & { totalInGroup?: number })[] = [];
        groups.forEach((items) => {
            items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            groupedBookings.push({ ...items[0], totalInGroup: items.length });
        });

        // Combine and sort
        return [...singles, ...groupedBookings].sort((a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
    };

    const handleCancel = async (booking: Booking & { totalInGroup?: number }) => {
        const result = await Swal.fire({
            title: 'Cancel Booking?',
            text: booking.totalInGroup && booking.totalInGroup > 1
                ? `There are ${booking.totalInGroup} recurring bookings. Cancel this one or all?`
                : 'Are you sure you want to cancel this booking?',
            icon: 'warning',
            showCancelButton: true,
            showDenyButton: !!(booking.totalInGroup && booking.totalInGroup > 1),
            confirmButtonColor: '#dc2626',
            denyButtonColor: '#f59e0b',
            cancelButtonColor: '#64748b',
            confirmButtonText: booking.totalInGroup && booking.totalInGroup > 1 ? 'Cancel This One' : 'Cancel',
            denyButtonText: 'Cancel All',
            cancelButtonText: 'Back'
        });

        if (!result.isConfirmed && !result.isDenied) return;

        const token = localStorage.getItem('token');
        try {
            let response;
            if (result.isDenied && booking.groupId) {
                // Cancel entire series
                response = await fetch(`${config.apiServer}/api/bookings/cancel-series/${booking.groupId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                // Cancel single
                response = await fetch(`${config.apiServer}/api/bookings/${booking.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }

            if (response.ok) {
                await Swal.fire({ title: 'Success!', icon: 'success', timer: 800, showConfirmButton: false });
                await fetchMyBookings();
                onBookingCancelled?.();
            } else {
                const errorData = await response.json();
                Swal.fire('Failed', errorData.error || 'Unable to cancel', 'error');
            }
        } catch (error) {
            console.error('Cancel error:', error);
            Swal.fire('Failed', 'Unable to cancel', 'error');
        }
    };

    const displayBookings = getDisplayBookings();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-xl font-bold text-slate-800">My Bookings</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors bg-white hover:bg-slate-100 rounded-full p-2 border border-slate-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="flex justify-center p-8 text-slate-400">Loading...</div>
                    ) : displayBookings.length === 0 ? (
                        <div className="text-center p-12">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <p className="text-slate-500 font-medium">No upcoming bookings</p>
                            <p className="text-xs text-slate-400 mt-1">Your bookings will appear here</p>
                        </div>
                    ) : (
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50 p-4 space-y-3">
                            {displayBookings.map((b: any) => (
                                <div key={b.id} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-slate-900 font-bold text-sm">{b.topic}</p>
                                            {b.totalInGroup && b.totalInGroup > 1 && (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                                                    🔁 {b.totalInGroup} items
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-blue-600 font-semibold mb-1 bg-blue-50 inline-block px-2 py-0.5 rounded">{b.room.name}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                            <span className="font-medium">{formatDate(b.startTime)}</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="font-mono">{formatTimeRange(b.startTime, b.endTime)}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleCancel(b)}
                                        className="text-red-500 hover:text-red-700 text-xs font-semibold px-4 py-2 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

