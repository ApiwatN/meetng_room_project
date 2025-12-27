'use client';

import { useState, useEffect } from 'react';

export default function SystemClock() {
    const [time, setTime] = useState<string>('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Initial time
        setTime(new Date().toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }));

        const interval = setInterval(() => {
            setTime(new Date().toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    if (!mounted) return <span className="text-xs">Loading...</span>;

    return (
        <span className="font-mono font-medium tabular-nums text-slate-700">
            {time}
        </span>
    );
}
