'use client';

export default function SessionGuard({ children }: { children: React.ReactNode }) {
    // Idle timer disabled - using JWT expiration (7 days) only
    return <>{children}</>;
}
