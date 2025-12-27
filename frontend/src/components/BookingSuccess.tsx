'use client';

import { useRef } from 'react';
import html2canvas from 'html2canvas';

interface BookingSuccessProps {
    booking: any;
    onClose: () => void;
}

export default function BookingSuccess({ booking, onClose }: BookingSuccessProps) {
    const ticketRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!ticketRef.current) return;
        try {
            const canvas = await html2canvas(ticketRef.current, { scale: 2 });
            const link = document.createElement('a');
            link.download = `booking-ticket-${booking.pinCode}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
        } catch (error) {
            console.error('Failed to generate ticket image', error);
            alert('Could not download ticket. Please screenshot manually.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col items-center">
                
                {/* Visual Header */}
                <div className="w-full bg-emerald-500 p-6 text-center text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
                    <p className="text-emerald-100 text-sm mt-1">Ref: #{booking.id}</p>
                </div>

                {/* Ticket Content (To be captured) */}
                <div ref={ticketRef} className="bg-white p-8 w-full text-center space-y-4">
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50">
                         <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Room</h3>
                         <p className="text-xl font-bold text-slate-800 mb-4">{booking.room?.name || 'Meeting Room'}</p>
                         
                         <div className="grid grid-cols-2 gap-4 text-left border-t border-slate-200 pt-4">
                            <div>
                                <p className="text-xs text-slate-400 font-semibold uppercase">Date</p>
                                <p className="text-sm font-bold text-slate-700">{new Date(booking.startTime).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-semibold uppercase">Time</p>
                                <p className="text-sm font-bold text-slate-700">
                                    {new Date(booking.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(booking.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            </div>
                         </div>
                         
                         <div className="mt-4 pt-4 border-t border-slate-200">
                            <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Topic</p>
                             <p className="text-sm font-black text-slate-900">{booking.topic}</p>
                         </div>
                    </div>

                    <div className="pt-2">
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Your Access PIN</p>
                        <p className="text-3xl font-black text-slate-900 tracking-widest">{booking.pinCode}</p>
                    </div>
                     <p className="text-[10px] text-slate-400 italic mt-2">Please save this ticket for your reference.</p>
                </div>

                {/* Actions */}
                <div className="w-full p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                    <button 
                        onClick={handleDownload}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Save Ticket as Image
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}
