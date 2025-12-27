import { format } from 'date-fns';

/**
 * Standard date format: dd/MMM/yyyy (e.g., "21/Dec/2025")
 */
export const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'dd/MMM/yyyy');
};

/**
 * Standard date-time format: dd/MMM/yyyy HH:mm (e.g., "21/Dec/2025 14:30")
 */
export const formatDateTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'dd/MMM/yyyy HH:mm');
};

/**
 * Standard time format: HH:mm (e.g., "14:30")
 */
export const formatTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'HH:mm');
};

/**
 * Format time range: HH:mm - HH:mm (e.g., "14:30 - 15:30")
 */
export const formatTimeRange = (start: Date | string, end: Date | string): string => {
    return `${formatTime(start)} - ${formatTime(end)}`;
};
