import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

export const getRooms = async (req: Request, res: Response) => {
    try {
        const rooms = await prisma.room.findMany({
            include: {
                bookings: {
                    where: {
                        startTime: { lte: new Date() },
                        endTime: { gte: new Date() }
                    },
                    include: { user: true }
                }
            }
        });

        // Map to add 'status' dynamically based on bookings if not maintenance
        const roomsWithStatus = rooms.map(room => {
            if (room.status === 'MAINTENANCE') return room;
            const currentBooking = room.bookings[0];
            if (currentBooking) {
                return {
                    ...room,
                    status: 'OCCUPIED',
                    currentBooking: {
                        user: currentBooking.user.username,
                        topic: currentBooking.isPrivate ? 'Confidential' : currentBooking.topic,
                        endTime: currentBooking.endTime
                    }
                };
            }
            return { ...room, status: 'AVAILABLE' };
        });

        res.json(roomsWithStatus);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
};

export const createRoom = async (req: Request, res: Response) => {
    // Admin only check (middleware should handle this)
    try {
        const room = await prisma.room.create({
            data: req.body
        });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create room' });
    }
}
