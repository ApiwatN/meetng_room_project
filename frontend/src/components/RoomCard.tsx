'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import config from '@/config';

interface Room {
    id: number;
    name: string;
    capacity: number;
    status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
    imageUrl?: string;
    facilities?: string | string[];
    currentBooking?: {
        user: string;
        topic: string;
        endTime: string;
    };
    nextBooking?: {
        topic: string;
        startTime: string;
        endTime: string;
    };
    nextBooking2?: {
        topic: string;
        startTime: string;
        endTime: string;
    };
}

interface RoomCardProps {
    room: Room;
    onBook: (roomId: number) => void;
    isGuest?: boolean;
}

export default function RoomCard({ room, onBook, isGuest = false }: RoomCardProps) {
    const router = useRouter();
    const isAvailable = room.status === 'AVAILABLE';
    const isOccupied = room.status === 'OCCUPIED';

    // Minimalist Status Colors
    let statusColor = "bg-slate-100 text-slate-600";
    let statusText = "Maintenance";

    if (isAvailable) {
        statusColor = "bg-emerald-50 text-emerald-700 border border-emerald-100";
        statusText = "Available";
    }
    if (isOccupied) {
        statusColor = "bg-white border border-slate-200"; // Cleaner look for occupied, let the content speak
        statusText = "Occupied";
    }

    return (
        <div className={`group relative bg-white rounded-xl border transition-all duration-200 flex flex-col justify-between h-full overflow-hidden
            ${isOccupied ? 'border-slate-200' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}
        `}>
            {/* Room Image - Compact Height */}
            <div className="h-28 bg-slate-100 relative shrink-0">
                {room.imageUrl ? (
                    <img
                        src={room.imageUrl?.includes('/uploads/') ? `${config.apiServer}/uploads/${room.imageUrl.split('/uploads/')[1]}` : room.imageUrl}
                        alt={room.name}
                        className="w-full h-full object-cover transition-opacity duration-300 opacity-100"
                        onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=Room&background=random&size=400'; }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                        <span className="text-4xl">🏢</span>
                    </div>
                )}

                {/* Status Badge Overlay */}
                <div className="absolute top-4 right-4">
                    {isAvailable && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${statusColor}`}>
                            {statusText}
                        </span>
                    )}
                </div>
            </div>

            <div className="p-3 flex flex-col grow">
                <div className="mb-1">
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{room.name}</h3>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        {room.capacity} Seats
                    </p>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2 shrink-0">
                    {(() => {
                        // Parse facilities - handle both string and array formats
                        let facilitiesArray: string[] = [];
                        if (typeof room.facilities === 'string' && room.facilities.trim()) {
                            facilitiesArray = room.facilities.split(',').map((s: string) => s.trim()).filter((s: string) => s);
                        } else if (Array.isArray(room.facilities)) {
                            facilitiesArray = room.facilities;
                        }

                        // Fallback to defaults only if no facilities from database
                        if (facilitiesArray.length === 0) {
                            const base = ['WiFi'];
                            const n = (room.name || '').toLowerCase();
                            if (n.includes('boardroom')) facilitiesArray = [...base, 'Video Conf', 'Smart TV', 'Premium'];
                            else if (room.capacity >= 20) facilitiesArray = [...base, 'Projector', 'Audio System', 'Video Conf'];
                            else if (room.capacity >= 8) facilitiesArray = [...base, 'Projector', 'Whiteboard'];
                            else facilitiesArray = [...base, 'LED TV', 'Whiteboard'];
                        }

                        return facilitiesArray.map((item, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] font-medium border border-slate-200 rounded-md">
                                {item}
                            </span>
                        ));
                    })()}
                </div>

                <div className="space-y-1 grow flex flex-col justify-end">
                    {/* Slot 1: Current Booking (if occupied) or Next Booking (if available) */}
                    {isOccupied && room.currentBooking ? (
                        <div className="bg-red-50 border border-red-100 rounded-md p-2 h-[50px] flex flex-col justify-center relative overflow-hidden">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide leading-none">In Use</span>
                                <span className="text-[10px] text-red-400 ml-auto font-mono bg-white/50 px-1 rounded">
                                    Until {new Date(room.currentBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-800 line-clamp-1 leading-tight">{room.currentBooking.topic}</p>
                            <div className="absolute top-0 right-0 w-16 h-full bg-gradient-to-l from-red-50 to-transparent pointer-events-none"></div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2 h-[50px] flex flex-col justify-center relative overflow-hidden">
                            {room.nextBooking ? (
                                <>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded font-bold uppercase tracking-wide leading-none py-0.5">Next</span>
                                        <div className="text-[9px] text-slate-500 flex items-center gap-1 ml-auto">
                                            <span className="font-semibold text-slate-600">
                                                {(() => {
                                                    const d = new Date(room.nextBooking!.startTime);
                                                    const today = new Date();
                                                    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                                                    return isToday ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                                                })()}
                                            </span>
                                            <span>
                                                {new Date(room.nextBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(room.nextBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-700 line-clamp-1 leading-tight">{room.nextBooking.topic}</p>
                                    <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-slate-50 to-transparent pointer-events-none"></div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center text-slate-400 text-[10px] gap-1.5 h-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    Ready for booking
                                </div>
                            )}
                        </div>
                    )}

                    {/* Slot 2: Next Booking (if occupied) or Following Booking (if available) */}
                    {(isOccupied && room.nextBooking) || (!isOccupied && room.nextBooking2) ? (
                        <div className="bg-slate-50/50 border border-slate-100/60 rounded-md p-2 h-[50px] flex flex-col justify-center relative overflow-hidden">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded font-bold uppercase tracking-wide leading-none py-0.5">Then</span>
                                <div className="text-[9px] text-slate-400 flex items-center gap-1 ml-auto">
                                    <span className="font-medium text-slate-500">
                                        {(() => {
                                            const booking = isOccupied ? room.nextBooking : room.nextBooking2;
                                            if (!booking) return '';
                                            const d = new Date(booking.startTime);
                                            const today = new Date();
                                            const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                                            return isToday ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                                        })()}
                                    </span>
                                    <span>
                                        {(() => {
                                            const booking = isOccupied ? room.nextBooking : room.nextBooking2;
                                            if (!booking) return '';
                                            return `${new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs font-medium text-slate-600 line-clamp-1 leading-tight">
                                {isOccupied ? room.nextBooking?.topic : room.nextBooking2?.topic}
                            </p>
                        </div>
                    ) : (
                        <div className="h-[50px] border border-dashed border-slate-100 rounded-md flex items-center justify-center text-[10px] text-slate-300">
                            No further bookings
                        </div>
                    )}
                </div>
            </div>

            <div className="p-3 border-t border-slate-50 bg-slate-50/50 rounded-b-xl mt-auto">
                <button
                    onClick={async () => {
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
                        } else {
                            onBook(room.id);
                        }
                    }}
                    disabled={!isAvailable}
                    className={`w-full py-2 rounded-lg font-semibold text-xs transition-all duration-200 
                        ${isAvailable
                            ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    {isAvailable ? 'Book Room' : 'Unavailable'}
                </button>
            </div>
        </div>
    );
}
