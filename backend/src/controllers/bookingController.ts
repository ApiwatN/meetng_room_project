import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

export const createBooking = async (req: Request, res: Response) => {
    const { roomId, userId, startTime, endTime, topic, isPrivate } = req.body;
    const start = new Date(startTime);
    const end = new Date(endTime);

    try {
        const booking = await prisma.$transaction(async (tx) => {
            // 1. Race Condition Check
            const conflict = await tx.booking.findFirst({
                where: {
                    roomId: Number(roomId),
                    OR: [
                        { startTime: { lt: end }, endTime: { gt: start } }
                    ]
                }
            });

            if (conflict) {
                throw new Error('Room is already booked for this time slot');
            }

            // 2. Create Booking
            const newBooking = await tx.booking.create({
                data: {
                    roomId: Number(roomId),
                    userId: Number(userId),
                    startTime: start,
                    endTime: end,
                    topic,
                    isPrivate: !!isPrivate,
                    pinCode: Math.floor(1000 + Math.random() * 9000).toString(),
                },
                include: { room: true, user: true }
            });

            return newBooking;
        });

        // 3. Emit Socket Event
        const io = req.app.get('io');
        io.emit('booking_created', {
            roomId: booking.roomId,
            status: 'OCCUPIED'
        });

        res.json(booking);
    } catch (error: any) {
        if (error.message === 'Room is already booked for this time slot') {
            res.status(409).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Booking failed: ' + error.message });
        }
    }
};

export const getMyBookings = async (req: any, res: Response) => {
    try {
        const bookings = await prisma.booking.findMany({
            where: { userId: req.user.userId },
            include: { room: true },
            orderBy: { startTime: 'desc' }
        });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
};

export const cancelBooking = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const role = req.user.role;

    try {
        const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        // Authorization: Owner or Admin
        if (booking.userId !== userId && role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized to cancel this booking' });
        }

        const deleted = await prisma.booking.delete({ where: { id: Number(id) } });

        // Emit update
        const io = req.app.get('io');
        io.emit('room_update', { id: deleted.roomId }); // Trigger refresh
        io.emit('booking_created'); // Refresh timelines

        res.json({ message: 'Booking cancelled' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
};
