'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import Navbar from '@/components/Navbar';
import RoomCard from '@/components/RoomCard';
import BookingModal from '@/components/BookingModal';
import MyBookingsModal from '@/components/MyBookingsModal';
import Timeline from '@/components/Timeline';
import AdminCalendar from '@/components/admin/AdminCalendar';
import DashboardStats from '@/components/admin/DashboardStats';
import RoomManager from '@/components/admin/RoomManager';
import UserManager from '@/components/admin/UserManager';
import config from '@/config';
import SessionGuard from '@/components/SessionGuard';
import SystemClock from '@/components/SystemClock';
import { useAuth } from '@/contexts/AuthContext';

interface Room {
    id: number;
    name: string;
    capacity: number;
    status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
    imageUrl?: string;
    currentBooking?: {
        user: string;
        topic: string;
        endTime: string;
    };
    bookings?: any[];
}

export default function Dashboard() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [showMyBookings, setShowMyBookings] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('dashboard');
    const [isTabLoaded, setIsTabLoaded] = useState(false);
    const [bookingCount, setBookingCount] = useState<number>(0);
    const [allBookings, setAllBookings] = useState<any[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const router = useRouter();
    const { user, token, isGuest, logout } = useAuth();

    // Reset to dashboard tab when logging out
    useEffect(() => {
        if (isGuest) {
            setActiveTab('dashboard');
        }
    }, [isGuest]);

    const fetchRooms = async () => {
        try {
            // Fetch rooms - works for both guests and logged-in users
            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${config.apiServer}/api/rooms`, { headers });
            if (res.ok) {
                const data = await res.json();
                setRooms(data);
            }
        } catch (error) {
            console.error('Failed to fetch rooms', error);
        }
    };

    const fetchMyBookingsCount = async () => {
        if (!token) return; // Guest doesn't have bookings
        try {
            const res = await fetch(`${config.apiServer}/api/bookings/my`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Count only future bookings, grouped by groupId (1 per group)
                const now = new Date();
                const future = data.filter((b: any) => new Date(b.startTime) >= now);
                const groups = new Set(future.filter((b: any) => b.groupId).map((b: any) => b.groupId));
                const singles = future.filter((b: any) => !b.groupId).length;
                setBookingCount(groups.size + singles);
            }
        } catch (error) {
            console.error('Failed to fetch booking count', error);
        }
    };

    const fetchAllBookings = async () => {
        try {
            // Fetch all bookings - works for both guests and logged-in users
            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${config.apiServer}/api/bookings/all`, { headers });
            if (res.ok) {
                const data = await res.json();
                setAllBookings(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Use user data from AuthContext
    const userRole = user?.role || 'USER';
    const username = user?.username || '';

    useEffect(() => {
        const handleRefresh = () => {
            fetchRooms();
            fetchMyBookingsCount();
            fetchAllBookings();
        };

        handleRefresh();

        // Socket.IO
        const socket = io(config.apiServer);
        socket.on('connect', () => console.log('Connected to websocket'));
        socket.on('booking_created', handleRefresh);
        socket.on('booking_updated', handleRefresh);
        socket.on('booking_deleted', handleRefresh);
        socket.on('room_update', handleRefresh);

        // Update time every second for real-time status check
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);

        // Refresh bookings periodically fallback
        const bookingInterval = setInterval(fetchAllBookings, 30000);

        return () => {
            clearInterval(interval);
            clearInterval(bookingInterval);
            socket.disconnect();
        };
    }, []);

    // Load active tab from localStorage on client mount
    useEffect(() => {
        const savedTab = localStorage.getItem('activeTab');
        if (savedTab) {
            setActiveTab(savedTab);
        }
        setIsTabLoaded(true);
    }, []);

    // Save active tab to localStorage when it changes (after initial load)
    useEffect(() => {
        if (isTabLoaded) {
            localStorage.setItem('activeTab', activeTab);
        }
    }, [activeTab, isTabLoaded]);

    const handleBook = (roomId: number) => {
        const room = rooms.find(r => r.id === roomId);
        if (room) setSelectedRoom(room);
    };

    // Derive displayed rooms with real-time status
    const displayedRooms = rooms.map(room => {
        // Find active booking
        const activeBooking = allBookings.find(b =>
            b.roomId === room.id &&
            b.status !== 'CANCELLED' &&
            new Date(b.startTime) <= currentTime &&
            new Date(b.endTime) > currentTime
        );

        // Find next booking (nearest future booking)
        const sortedFutureBookings = allBookings
            .filter(b =>
                b.roomId === room.id &&
                b.status !== 'CANCELLED' &&
                new Date(b.startTime) > currentTime
            )
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        const nextBooking = sortedFutureBookings[0];
        const nextBooking2 = sortedFutureBookings[1];

        if (activeBooking) {
            return {
                ...room,
                status: 'OCCUPIED' as const,
                currentBooking: {
                    user: activeBooking.user?.username || activeBooking.user?.employeeId || 'Unknown',
                    topic: activeBooking.topic,
                    endTime: activeBooking.endTime
                },
                nextBooking: nextBooking ? {
                    topic: nextBooking.topic,
                    startTime: nextBooking.startTime,
                    endTime: nextBooking.endTime
                } : undefined,
                nextBooking2: nextBooking2 ? {
                    topic: nextBooking2.topic,
                    startTime: nextBooking2.startTime,
                    endTime: nextBooking2.endTime
                } : undefined
            };
        }
        return {
            ...room,
            status: 'AVAILABLE' as const,
            currentBooking: undefined,
            nextBooking: nextBooking ? {
                topic: nextBooking.topic,
                startTime: nextBooking.startTime,
                endTime: nextBooking.endTime
            } : undefined,
            nextBooking2: nextBooking2 ? {
                topic: nextBooking2.topic,
                startTime: nextBooking2.startTime,
                endTime: nextBooking2.endTime
            } : undefined
        };
    });

    return (
        <SessionGuard>
            <div className="min-h-screen bg-slate-50 pb-20">
                <Navbar
                    userRole={userRole}
                    username={username}
                    onOpenMyBookings={isGuest ? undefined : () => { setShowMyBookings(true); }}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    bookingCount={bookingCount}
                    isGuest={isGuest}
                    onLogout={logout}
                />

                <main className="container mx-auto px-6 py-8">

                    {/* Overview (Admin Only) - Dashboard Stats */}
                    {activeTab === 'overview' && userRole === 'ADMIN' && (
                        <DashboardStats />
                    )}

                    {/* Dashboard - Room Cards & Timeline */}
                    {activeTab === 'dashboard' && (
                        <>
                            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
                                    <p className="text-slate-500 mt-1">Make a reservation or check room availability.</p>
                                </div>

                                <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm min-w-[140px] justify-center">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <SystemClock />
                                </div>
                            </div>

                            <div className="mb-10">
                                <div className="mb-10">
                                    <Timeline rooms={displayedRooms} onRefresh={() => { fetchRooms(); fetchAllBookings(); }} isGuest={isGuest} />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    Available Rooms
                                    <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{displayedRooms.filter(r => r.status === 'AVAILABLE').length} Available</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {rooms.length === 0 ? (
                                        <div className="col-span-full py-12 text-center text-slate-400">Loading rooms...</div>
                                    ) : (
                                        displayedRooms.map(room => (
                                            <RoomCard key={room.id} room={room} onBook={handleBook} isGuest={isGuest} />
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Calendar */}
                    {activeTab === 'calendar' && (
                        <AdminCalendar />
                    )}

                    {/* Rooms (Admin Only) */}
                    {activeTab === 'rooms' && userRole === 'ADMIN' && (
                        <RoomManager />
                    )}

                    {/* Users (Admin Only) */}
                    {activeTab === 'users' && userRole === 'ADMIN' && (
                        <UserManager />
                    )}
                </main>

                {selectedRoom && (
                    <BookingModal
                        roomId={selectedRoom.id}
                        roomName={selectedRoom.name}
                        onClose={() => setSelectedRoom(null)}
                        onSuccess={() => {
                            fetchRooms();
                        }}
                    />
                )}

                {showMyBookings && (
                    <MyBookingsModal
                        onClose={() => setShowMyBookings(false)}
                        onBookingCancelled={() => {
                            fetchRooms();
                            fetchMyBookingsCount();
                        }}
                    />
                )}
            </div>
        </SessionGuard >
    );
}


