'use client';

import { useRef } from 'react';
import html2canvas from 'html2canvas';

interface BookingSuccessModalProps {
    booking: {
        roomName: string;
        topic: string;
        startTime: string;
        endTime: string;
        pinCode?: string;
        skippedDates?: string[];
        totalBooked?: number;
        totalSkipped?: number;
    };
    onClose: () => void;
}

export default function BookingSuccessModal({ booking, onClose }: BookingSuccessModalProps) {
    const ticketRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!ticketRef.current) return;

        try {
            const canvas = await html2canvas(ticketRef.current, {
                scale: 2, // Higher resolution
                backgroundColor: '#ffffff'
            });

            const image = canvas.toDataURL('image/jpeg', 1.0);
            const link = document.createElement('a');
            link.href = image;
            link.download = `Meeting-Ticket-${booking.pinCode || 'booking'}.jpg`;
            link.click();
        } catch (error) {
            console.error('Failed to generate ticket image', error);
            alert('Failed to download ticket');
        }
    };

    const formatDateTimeLocal = (dateStr: string) => {
        const d = new Date(dateStr);
        const date = `${d.getDate().toString().padStart(2, '0')}/${d.toLocaleString('en-US', { month: 'short' })}/${d.getFullYear()}`;
        const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        return `${date} ${time}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Booking Confirmed!</h2>
                    <p className="text-slate-500 mt-1">Your room has been successfully reserved.</p>
                </div>

                {/* Ticket View */}
                <div className="px-6 pb-6 flex justify-center">
                    <div
                        ref={ticketRef}
                        className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 w-full relative"
                    >
                        {/* Cutout circles for ticket effect */}
                        <div className="absolute top-1/2 -left-3 w-6 h-6 bg-white rounded-full border-r border-slate-200" />
                        <div className="absolute top-1/2 -right-3 w-6 h-6 bg-white rounded-full border-l border-slate-200" />

                        <div className="text-center border-b border-slate-200 pb-4 mb-4">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Meeting Ticket</h3>
                            <div className="text-3xl font-black text-slate-900 mt-2 tracking-widest">
                                {booking.pinCode || '####'}
                            </div>
                            <span className="text-xs text-slate-400">Booking PIN</span>
                        </div>

                        <div className="space-y-3 text-left">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Room</span>
                                <p className="font-bold text-slate-800">{booking.roomName}</p>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Topic</span>
                                <p className="font-bold text-slate-800 truncate">{booking.topic}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase">Start</span>
                                    <p className="font-semibold text-slate-700 text-sm">{formatDateTimeLocal(booking.startTime)}</p>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase">End</span>
                                    <p className="font-semibold text-slate-700 text-sm">{formatDateTimeLocal(booking.endTime)}</p>
                                </div>
                            </div>
                            {/* Show skipped dates info for recurring bookings */}
                            {booking.totalBooked && booking.totalBooked > 1 && (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-green-600 font-medium">✓ Success: {booking.totalBooked} days</span>
                                        {booking.totalSkipped && booking.totalSkipped > 0 && (
                                            <span className="text-orange-500 font-medium">⊘ Skipped: {booking.totalSkipped} days</span>
                                        )}
                                    </div>
                                    {booking.skippedDates && booking.skippedDates.length > 0 && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            Skipped dates: {booking.skippedDates.slice(0, 3).join(', ')}
                                            {booking.skippedDates.length > 3 && ` +${booking.skippedDates.length - 3} more`}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
                            <p className="text-[10px] text-slate-400">Please present this digital ticket if requested.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex-1 px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Save Ticket
                    </button>
                </div>
            </div>
        </div>
    );
}
