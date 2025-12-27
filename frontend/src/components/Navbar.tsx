'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import Swal from 'sweetalert2';

interface NavbarProps {
    userRole?: string;
    onOpenMyBookings?: () => void;
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    bookingCount?: number;
    username?: string;
    isGuest?: boolean;
    onLogout?: () => void;
}

export default function Navbar({ userRole = 'USER', onOpenMyBookings, activeTab, onTabChange, bookingCount, username, isGuest = false, onLogout }: NavbarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        const result = await Swal.fire({
            title: 'Sign Out?',
            text: 'Are you sure you want to sign out?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sign Out',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            if (onLogout) {
                onLogout();
            }
            await Swal.fire({
                title: 'Signed Out',
                icon: 'success',
                timer: 800,
                showConfirmButton: false
            });
            router.push('/dashboard');
        }
    };

    const handleTabClick = (tab: string) => {
        if (onTabChange) {
            onTabChange(tab);
        }
        setMobileMenuOpen(false);
    };

    const menuItems = [
        ...(userRole === 'ADMIN' ? [{ key: 'overview', label: 'Overview' }] : []),
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'calendar', label: 'Calendar' },
        ...(userRole === 'ADMIN' ? [
            { key: 'rooms', label: 'Rooms' },
            { key: 'users', label: 'Users' }
        ] : [])
    ];

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
            <div className="container mx-auto px-4 md:px-6 h-16 flex justify-between items-center">
                <div className="flex items-center gap-4 md:gap-8">
                    {/* Logo */}
                    <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">FDB</div>
                        <h1 className="text-base md:text-lg font-bold text-slate-800">Meeting Room</h1>
                    </button>

                    {/* Desktop Navigation Tabs */}
                    {onTabChange && (
                        <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                            {menuItems.map(item => (
                                <button
                                    key={item.key}
                                    onClick={() => handleTabClick(item.key)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === item.key
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 md:gap-4 items-center">
                    {/* User Info - Desktop (only show if logged in) */}
                    {!isGuest && username && (
                        <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-medium">{username}</span>
                            {userRole === 'ADMIN' && (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>
                            )}
                        </div>
                    )}

                    {/* Bell Icon (only show if logged in) */}
                    {!isGuest && onOpenMyBookings && (
                        <button
                            onClick={onOpenMyBookings}
                            className="relative text-slate-600 hover:text-slate-900 transition-colors p-2 rounded-lg hover:bg-slate-100"
                            title="My Bookings"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {bookingCount !== undefined && bookingCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                                    {bookingCount > 99 ? '99+' : bookingCount}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Sign In / Sign Out - Desktop */}
                    {isGuest ? (
                        <button
                            onClick={() => router.push('/login')}
                            className="hidden md:block text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            Sign In
                        </button>
                    ) : (
                        <button
                            onClick={handleLogout}
                            className="hidden md:block text-sm font-medium text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            Sign Out
                        </button>
                    )}

                    {/* Hamburger Menu Button - Mobile */}
                    {onTabChange && (
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && onTabChange && (
                <div className="md:hidden bg-white border-t border-slate-100 shadow-lg animate-in slide-in-from-top duration-200">
                    {/* User Info - Mobile (only show if logged in) */}
                    {!isGuest && username && (
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="font-medium">{username}</span>
                                {userRole === 'ADMIN' && (
                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Menu Items */}
                    <div className="py-2">
                        {menuItems.map(item => (
                            <button
                                key={item.key}
                                onClick={() => handleTabClick(item.key)}
                                className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === item.key
                                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                                    : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Sign In / Sign Out - Mobile */}
                    <div className="px-4 py-3 border-t border-slate-100">
                        {isGuest ? (
                            <button
                                onClick={() => { router.push('/login'); setMobileMenuOpen(false); }}
                                className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                                Sign In
                            </button>
                        ) : (
                            <button
                                onClick={handleLogout}
                                className="w-full text-center text-sm font-medium text-red-600 hover:text-red-700 py-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                                Sign Out
                            </button>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}


