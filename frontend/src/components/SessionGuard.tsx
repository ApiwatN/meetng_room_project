'use client';

export default function SessionGuard({ children }: { children: React.ReactNode }) {
    // Session persists until user explicitly signs out (no token expiration)
    return <>{children}</>;
}
