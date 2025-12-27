'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SessionGuard from '@/components/SessionGuard';
import Navbar from '@/components/Navbar';
import DashboardStats from '@/components/admin/DashboardStats';
import AdminCalendar from '@/components/admin/AdminCalendar';
import RoomManager from '@/components/admin/RoomManager';
import UserManager from '@/components/admin/UserManager';

export default function AdminPage() {
    return (
        <SessionGuard>
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <Navbar userRole="ADMIN" />
                <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
                    <AdminPageContent />
                </Suspense>
            </div>
        </SessionGuard>
    );
}

function AdminPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Default to 'dashboard' if no view param
    const currentView = searchParams.get('view') || 'dashboard';

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('token');
            const userStr = localStorage.getItem('user');

            if (!token || !userStr) {
                router.push('/login');
                return;
            }

            const user = JSON.parse(userStr);
            if (user.role !== 'ADMIN') {
                router.push('/dashboard');
                return;
            }

            setIsAuthorized(true);
        };
        checkAuth();
    }, [router]);

    if (!isAuthorized) return null;

    const renderContent = () => {
        switch (currentView) {
            case 'dashboard':
                return <DashboardStats />;
            case 'calendar':
                return <AdminCalendar />;
            case 'rooms':
                return <RoomManager />;
            case 'users':
                return <UserManager />;
            default:
                return <DashboardStats />;
        }
    };

    return (
        <main className="flex-1 p-8 overflow-y-auto w-full">
            <div className="max-w-6xl mx-auto">
                {renderContent()}
            </div>
        </main>
    );
}
