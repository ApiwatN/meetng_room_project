import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export const useIdleTimer = (timeoutMs: number = 604800000) => { // Default 7 days
    const router = useRouter();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        alert('Session timed out due to inactivity.');
        router.push('/dashboard');
    };

    const resetTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(logout, timeoutMs);
    };

    useEffect(() => {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        // Init timer
        resetTimer();

        const handleActivity = () => {
            resetTimer();
        };

        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [router, timeoutMs]);
};
