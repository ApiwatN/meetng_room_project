const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(express.json());

// Serve Static Files
app.use('/uploads', express.static('uploads'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const allowCors = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Intercept OPTIONS method
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
};

// Upload Route - Manual CORS
app.options('/api/upload', allowCors);
app.post('/api/upload', upload.single('image'), (req, res) => {
    // Set CORS headers explicitly
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return relative path
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Share io with app
app.set('io', io);

// --- Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// --- Controllers ---

// Auth
const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        // Case-insensitive username (handled by SQL Server) and password
        const user = await prisma.user.findUnique({ where: { username: username.toUpperCase() } });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Compare password in uppercase for case-insensitivity
        const validPassword = await bcrypt.compare(password.toUpperCase(), user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { userId: user.id, role: user.role, forceChangePassword: user.forceChangePassword },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, user: { id: user.id, username: user.username, role: user.role, forceChangePassword: user.forceChangePassword, employeeId: user.employeeId, email: user.email, section: user.section, phoneNumber: user.phoneNumber } });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

const changePassword = async (req, res) => {
    const { userId } = req.user;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // Hash password in uppercase for case-insensitivity
        const hashedPassword = await bcrypt.hash(newPassword.toUpperCase(), 10);
        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                forceChangePassword: false
            }
        });
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update password' });
    }
};

// ...

// --- Routes Wiring ---

// Admins resetting other users' passwords
const resetUserPassword = async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });

    try {
        // Hash password in uppercase for case-insensitivity
        const hashedPassword = await bcrypt.hash(newPassword.toUpperCase(), 10);
        await prisma.user.update({
            where: { id: Number(id) },
            data: {
                password: hashedPassword,
                forceChangePassword: true // Admin reset forces user to change it again
            }
        });
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

const getRooms = async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            include: {
                bookings: {
                    where: {
                        startTime: { lte: new Date() },
                        endTime: { gte: new Date() },
                        status: 'CONFIRMED'
                    },
                    include: { user: true }
                }
            }
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const roomsForTimeline = await prisma.room.findMany({
            include: {
                bookings: {
                    where: {
                        startTime: { gte: todayStart, lte: todayEnd },
                        status: 'CONFIRMED'
                    },
                    include: {
                        user: {
                            select: {
                                username: true,
                                employeeId: true,
                                section: true,
                                phoneNumber: true
                            }
                        }
                    }
                }
            }
        });

        const result = roomsForTimeline.map(r => ({
            ...r,
            bookings: r.bookings.map(b => ({
                id: b.id,
                startTime: b.startTime,
                endTime: b.endTime,
                topic: b.topic,
                isPrivate: b.isPrivate,
                user: b.user,
                recurringType: b.recurringType,
                recurringEndDate: b.recurringEndDate,
                groupId: b.groupId
            }))
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
};

const createRoom = async (req, res) => {
    try {
        const room = await prisma.room.create({ data: req.body });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create room' });
    }
};

const updateRoom = async (req, res) => {
    const { id } = req.params;
    const { name, capacity, facilities, status, imageUrl } = req.body;
    try {
        const room = await prisma.room.update({
            where: { id: Number(id) },
            data: { name, capacity: Number(capacity), facilities, status, imageUrl }
        });
        io.emit('room_update', { id: room.id });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update room' });
    }
};

const deleteRoom = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.booking.deleteMany({ where: { roomId: Number(id) } });
        await prisma.room.delete({ where: { id: Number(id) } });
        io.emit('room_update');
        res.json({ message: 'Room deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete room' });
    }
};

const createBooking = async (req, res) => {
    const { roomId, userId, startTime, endTime, topic, isPrivate, recurringType, recurringEndDate, dryRun } = req.body;

    // Validate minimum duration (15 minutes)
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

    if (startDate >= endDate) {
        return res.status(400).json({ error: 'End time must be after start time' });
    }
    if (diffMinutes < 15) {
        return res.status(400).json({ error: 'Booking must be at least 15 minutes' });
    }

    const groupId = (recurringType && recurringType !== 'none') ? crypto.randomUUID() : null;

    // Helper to generate booking slots
    const generateSlots = () => {
        const slots = [];
        let currentStart = new Date(startTime);
        let currentEnd = new Date(endTime);
        const untilDate = recurringEndDate ? new Date(recurringEndDate) : new Date(startTime);

        // Set end of day for comparison
        untilDate.setHours(23, 59, 59, 999);

        // Limit maximum recurrences to prevent infinite loops or abuse (e.g., 365 days)
        const MAX_INSTANCES = 365;
        let count = 0;

        while (currentStart <= untilDate && count < MAX_INSTANCES) {
            slots.push({
                start: new Date(currentStart),
                end: new Date(currentEnd)
            });

            count++;
            if (!recurringType || recurringType === 'none') break;

            if (recurringType === 'daily') {
                currentStart.setDate(currentStart.getDate() + 1);
                currentEnd.setDate(currentEnd.getDate() + 1);
            } else if (recurringType === 'weekly') {
                currentStart.setDate(currentStart.getDate() + 7);
                currentEnd.setDate(currentEnd.getDate() + 7);
            } else if (recurringType === 'monthly') {
                currentStart.setMonth(currentStart.getMonth() + 1);
                currentEnd.setMonth(currentEnd.getMonth() + 1);
            }
        }
        return slots;
    };

    try {
        const slotsToBook = generateSlots();

        const result = await prisma.$transaction(async (tx) => {
            // 1. Filter out conflicting slots (skip them instead of failing)
            const availableSlots = [];
            const skippedSlots = [];

            for (const slot of slotsToBook) {
                const exactConflict = await tx.booking.findFirst({
                    where: {
                        roomId: Number(roomId),
                        startTime: { lt: slot.end },
                        endTime: { gt: slot.start },
                        status: { not: 'CANCELLED' }
                    }
                });

                if (exactConflict) {
                    // Skip this slot but record it
                    const conflictDate = slot.start.toLocaleDateString('en-GB');
                    skippedSlots.push(conflictDate);
                } else {
                    availableSlots.push(slot);
                }
            }

            // If no slots are available, throw error
            if (availableSlots.length === 0) {
                throw new Error('No available time slots. All dates have conflicts.');
            }

            // If dryRun mode, return preview without creating bookings
            if (dryRun) {
                return {
                    preview: true,
                    totalSlots: slotsToBook.length,
                    availableCount: availableSlots.length,
                    skippedCount: skippedSlots.length,
                    skippedDates: skippedSlots
                };
            }

            // 2. Create bookings for available slots
            const createdBookings = [];
            for (const slot of availableSlots) {
                // Create booking
                const booking = await tx.booking.create({
                    data: {
                        roomId: Number(roomId),
                        userId: Number(userId),
                        startTime: slot.start,
                        endTime: slot.end,
                        topic,
                        isPrivate: !!isPrivate,
                        pinCode: Math.floor(1000 + Math.random() * 9000).toString(),
                        status: 'CONFIRMED',
                        recurringType: recurringType || null,
                        recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
                        groupId: groupId
                    },
                    include: { room: true, user: true }
                });
                createdBookings.push(booking);
            }

            return { bookings: createdBookings, skipped: skippedSlots };
        });

        // If this was a dryRun, return preview without emitting events
        if (result.preview) {
            return res.json(result);
        }

        io.emit('booking_created');
        io.emit('room_update', { id: Number(roomId) });

        // Return first booking with info about skipped dates
        const response = result.bookings[0];
        response.skippedDates = result.skipped;
        response.totalBooked = result.bookings.length;
        response.totalSkipped = result.skipped.length;
        res.json(response);
    } catch (error) {
        if (error.message.startsWith('Conflict') || error.message.startsWith('No available')) {
            res.status(409).json({ error: error.message });
        } else {
            console.error('Booking error:', error);
            res.status(500).json({ error: 'Booking failed: ' + error.message });
        }
    }
};

const getMyBookings = async (req, res) => {
    try {
        const bookings = await prisma.booking.findMany({
            where: {
                userId: req.user.userId,
                status: { not: 'CANCELLED' }
            },
            include: { room: true },
            orderBy: { startTime: 'asc' },
            take: 50
        });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
};

const cancelBooking = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const role = req.user.role;

    try {
        const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        if (booking.userId !== userId && role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Prevent cancelling past bookings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(booking.startTime) < today) {
            return res.status(403).json({ error: 'Cannot cancel past bookings' });
        }

        await prisma.booking.update({
            where: { id: Number(id) },
            data: { status: 'CANCELLED' }
        });

        io.emit('booking_created');
        io.emit('room_update', { id: booking.roomId });

        res.json({ message: 'Booking cancelled' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
};

const updateBooking = async (req, res) => {
    const { id } = req.params;
    const { startTime, endTime, topic, isPrivate, roomId, recurringType, recurringEndDate, updateMode } = req.body;
    const userId = req.user.userId;
    const role = req.user.role;

    try {
        const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        if (booking.userId !== userId && role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (start >= end) {
            return res.status(400).json({ error: 'End time must be after start time' });
        }

        // Validate minimum duration (15 minutes)
        const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        if (diffMinutes < 15) {
            return res.status(400).json({ error: 'Booking must be at least 15 minutes' });
        }

        // Prevent modifying past bookings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(booking.startTime) < today) {
            return res.status(403).json({ error: 'Cannot modify past bookings' });
        }

        // Determine target room (if roomId provided, use it, else keep existing)
        const targetRoomId = roomId ? Number(roomId) : booking.roomId;

        // Logic for Series Update (updateMode === 'series')
        if (updateMode === 'series' && booking.groupId) {
            // Special Case: If changing to 'Does not repeat', cancel all OTHER events in series
            if (!recurringType || recurringType === 'none') {
                await prisma.$transaction(async (tx) => {
                    // 1. Update THIS booking (remove from group)
                    await tx.booking.update({
                        where: { id: Number(id) },
                        data: {
                            startTime: start,
                            endTime: end,
                            topic,
                            isPrivate: !!isPrivate,
                            roomId: targetRoomId,
                            recurringType: null,
                            recurringEndDate: null,
                            groupId: null // Remove from group
                        }
                    });

                    // 2. Cancel all OTHER future events in this series
                    await tx.booking.updateMany({
                        where: {
                            groupId: booking.groupId,
                            id: { not: Number(id) },
                            startTime: { gte: new Date() }
                        },
                        data: { status: 'CANCELLED' }
                    });
                });

                io.emit('booking_created');
                io.emit('room_update');
                res.json({ message: 'Series cancelled, this event kept as single.' });
                return;
            }

            // Normal Series Update: Update all events in the series
            // Include the current booking AND all future bookings
            const seriesBookings = await prisma.booking.findMany({
                where: {
                    groupId: booking.groupId,
                    status: { not: 'CANCELLED' },
                    OR: [
                        { id: Number(id) },  // Include the current booking being edited
                        { startTime: { gte: new Date() } }  // Plus all future bookings
                    ]
                }
            });

            await prisma.$transaction(async (tx) => {
                for (const b of seriesBookings) {
                    const newStart = new Date(b.startTime);
                    newStart.setHours(start.getHours(), start.getMinutes(), 0, 0);

                    const newEnd = new Date(b.endTime);
                    newEnd.setHours(end.getHours(), end.getMinutes(), 0, 0);

                    if (newEnd <= newStart) {
                        newEnd.setDate(newEnd.getDate() + 1);
                    }

                    const conflict = await tx.booking.findFirst({
                        where: {
                            roomId: targetRoomId,
                            id: { not: b.id },
                            status: { not: 'CANCELLED' },
                            startTime: { lt: newEnd },
                            endTime: { gt: newStart }
                        }
                    });

                    if (conflict) {
                        throw new Error(`Conflict for recurrence on ${newStart.toLocaleDateString('en-GB')} at ${newStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
                    }

                    await tx.booking.update({
                        where: { id: b.id },
                        data: {
                            startTime: newStart,
                            endTime: newEnd,
                            topic,
                            isPrivate: !!isPrivate,
                            roomId: targetRoomId,
                            recurringType: recurringType || null,
                            recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null
                        }
                    });
                }
            });

            io.emit('booking_created');
            io.emit('room_update');
            res.json({ message: 'Series updated successfully' });
            return;
        }

        // --- Single Update Logic (Existing) ---
        // Helper to generate booking slots (Starting from NEXT occurrence)
        const generateFutureSlots = () => {
            const slots = [];
            if (!recurringType || recurringType === 'none') return slots;

            let currentStart = new Date(start);
            let currentEnd = new Date(end);
            const untilDate = recurringEndDate ? new Date(recurringEndDate) : new Date(start);
            untilDate.setHours(23, 59, 59, 999);

            // Advance to next slot immediately because the *current* slot is handled by the main update
            if (recurringType === 'daily') {
                currentStart.setDate(currentStart.getDate() + 1);
                currentEnd.setDate(currentEnd.getDate() + 1);
            } else if (recurringType === 'weekly') {
                currentStart.setDate(currentStart.getDate() + 7);
                currentEnd.setDate(currentEnd.getDate() + 7);
            } else if (recurringType === 'monthly') {
                currentStart.setMonth(currentStart.getMonth() + 1);
                currentEnd.setMonth(currentEnd.getMonth() + 1);
            }

            const MAX_INSTANCES = 365;
            let count = 0;

            while (currentStart <= untilDate && count < MAX_INSTANCES) {
                slots.push({
                    start: new Date(currentStart),
                    end: new Date(currentEnd)
                });
                count++;
                // Increment for next loop
                if (recurringType === 'daily') {
                    currentStart.setDate(currentStart.getDate() + 1);
                    currentEnd.setDate(currentEnd.getDate() + 1);
                } else if (recurringType === 'weekly') {
                    currentStart.setDate(currentStart.getDate() + 7);
                    currentEnd.setDate(currentEnd.getDate() + 7);
                } else if (recurringType === 'monthly') {
                    currentStart.setMonth(currentStart.getMonth() + 1);
                    currentEnd.setMonth(currentEnd.getMonth() + 1);
                }
            }
            return slots;
        };

        const result = await prisma.$transaction(async (tx) => {
            // 1. Check overlap for the main booking update
            const overlap = await tx.booking.findFirst({
                where: {
                    roomId: targetRoomId,
                    id: { not: Number(id) }, // Exclude current booking
                    status: { not: 'CANCELLED' },
                    startTime: { lt: end },
                    endTime: { gt: start }
                }
            });

            if (overlap) throw new Error('Room is already booked for this time slot');

            // 2. Update the main booking
            // Generate a NEW groupId if this was a single update converting to recurring,
            // or if it's a recurring booking whose recurrence type is changing.
            // Otherwise, keep the existing groupId.
            let recurrenceGroupId = booking.groupId;
            if (recurringType && recurringType !== 'none' && !booking.groupId) {
                // Was not recurring, now is
                recurrenceGroupId = crypto.randomUUID();
            } else if ((!recurringType || recurringType === 'none') && booking.groupId) {
                // Was recurring, now is not
                recurrenceGroupId = null;
            }
            // If it was recurring and still is, and groupId exists, keep it.

            const updatedBooking = await tx.booking.update({
                where: { id: Number(id) },
                data: {
                    startTime: start,
                    endTime: end,
                    topic,
                    isPrivate: !!isPrivate,
                    roomId: targetRoomId,
                    recurringType: recurringType || null,
                    recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
                    groupId: recurrenceGroupId
                }
            });

            // 3. Handle Future Slots (New recurrences)
            // If the booking was previously recurring and is no longer, or its recurrence changed,
            // we need to cancel/delete old future occurrences.
            if (booking.groupId && (recurrenceGroupId === null || recurrenceGroupId !== booking.groupId)) {
                await tx.booking.updateMany({
                    where: {
                        groupId: booking.groupId,
                        id: { not: Number(id) }, // Don't cancel the current one
                        startTime: { gte: new Date() } // Only future occurrences
                    },
                    data: { status: 'CANCELLED' } // Or deleteMany
                });
            }

            const futureSlots = generateFutureSlots();
            for (const slot of futureSlots) {
                const conflict = await tx.booking.findFirst({
                    where: {
                        roomId: targetRoomId,
                        status: { not: 'CANCELLED' },
                        startTime: { lt: slot.end },
                        endTime: { gt: slot.start }
                    }
                });

                if (conflict) {
                    const conflictDate = slot.start.toLocaleDateString('en-GB');
                    const conflictTime = `${slot.start.getHours().toString().padStart(2, '0')}:${slot.start.getMinutes().toString().padStart(2, '0')}`;
                    throw new Error(`Conflict on ${conflictDate} at ${conflictTime}`);
                }

                await tx.booking.create({
                    data: {
                        roomId: targetRoomId,
                        userId: Number(booking.userId), // Keep original owner
                        startTime: slot.start,
                        endTime: slot.end,
                        topic,
                        isPrivate: !!isPrivate,
                        pinCode: Math.floor(1000 + Math.random() * 9000).toString(),
                        status: 'CONFIRMED',
                        recurringType: recurringType || null,
                        recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
                        groupId: recurrenceGroupId // Link to the new/existing group ID
                    }
                });
            }

            return updatedBooking;
        });

        io.emit('booking_created');
        io.emit('room_update', { id: result.roomId });
        res.json(result);

    } catch (error) {
        if (error.message.startsWith('Conflict') || error.message.includes('already booked')) {
            res.status(409).json({ error: error.message });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Failed to update booking' });
        }
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, employeeId: true, email: true, role: true, section: true, phoneNumber: true, name: true }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const createUser = async (req, res) => {
    const { username, password, role, employeeId, email, section, phoneNumber, name } = req.body;
    try {
        // Store username in uppercase and hash password in uppercase for case-insensitivity
        const upperUsername = username.toUpperCase();
        const hashedPassword = await bcrypt.hash(password.toUpperCase(), 10);
        const user = await prisma.user.create({
            data: { username: upperUsername, password: hashedPassword, role: role || 'USER', employeeId, email, section, phoneNumber, name, forceChangePassword: true }
        });

        io.emit('user_update');
        res.json({ id: user.id });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Username, Employee ID, or Email already exists' });
        }
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

// --- Routes Wiring ---

// Auth Routes
const authRouter = express.Router();
authRouter.post('/login', login);
authRouter.post('/change-password', authenticateToken, changePassword);
app.use('/api/auth', authRouter);

// Room Routes
const roomRouter = express.Router();
roomRouter.get('/', getRooms); // Public - guests can view rooms
roomRouter.post('/', authenticateToken, requireAdmin, createRoom);
roomRouter.put('/:id', authenticateToken, requireAdmin, updateRoom);
roomRouter.delete('/:id', authenticateToken, requireAdmin, deleteRoom);
app.use('/api/rooms', roomRouter);

// Booking Routes
const getAllBookings = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = {};

        if (startDate && endDate) {
            dateFilter = {
                startTime: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            };
        } else {
            // Default: Past 7 days to next 45 days
            const now = new Date();
            const startDef = new Date(now); startDef.setDate(now.getDate() - 7);
            const endDef = new Date(now); endDef.setDate(now.getDate() + 45);
            dateFilter = {
                startTime: {
                    gte: startDef,
                    lte: endDef
                }
            };
        }

        const bookings = await prisma.booking.findMany({
            where: {
                status: { not: 'CANCELLED' },
                ...dateFilter
            },
            include: { room: true, user: true },
            orderBy: { startTime: 'asc' }
        });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

const getRoomBookings = async (req, res) => {
    const { roomId } = req.params;
    try {
        const bookings = await prisma.booking.findMany({
            where: {
                roomId: Number(roomId),
                status: { not: 'CANCELLED' }
            },
            select: { id: true, startTime: true, endTime: true, recurringType: true, recurringEndDate: true }
        });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

// Cancel entire series by groupId
const cancelSeriesBooking = async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // Check if user owns at least one booking in this group (or is admin)
        const bookingsInGroup = await prisma.booking.findMany({
            where: { groupId, status: { not: 'CANCELLED' } }
        });

        if (bookingsInGroup.length === 0) {
            return res.status(404).json({ error: 'Series not found' });
        }

        // Check ownership (if not admin)
        if (userRole !== 'ADMIN' && !bookingsInGroup.some(b => b.userId === userId)) {
            return res.status(403).json({ error: 'Not authorized to cancel this series' });
        }

        // Cancel all future bookings in the series
        const now = new Date();
        const result = await prisma.booking.updateMany({
            where: {
                groupId,
                status: { not: 'CANCELLED' },
                startTime: { gte: now }
            },
            data: { status: 'CANCELLED' }
        });

        io.emit('booking_created');
        res.json({ message: `Cancelled ${result.count} bookings in series` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to cancel series' });
    }
};

const bookingRouter = express.Router();
bookingRouter.post('/', authenticateToken, createBooking);
bookingRouter.get('/my', authenticateToken, getMyBookings);
bookingRouter.get('/all', getAllBookings); // Public - guests can view all bookings
bookingRouter.get('/room/:roomId', authenticateToken, getRoomBookings);
bookingRouter.put('/:id', authenticateToken, updateBooking);
bookingRouter.delete('/cancel-series/:groupId', authenticateToken, cancelSeriesBooking);
bookingRouter.delete('/:id', authenticateToken, cancelBooking);
app.use('/api/bookings', bookingRouter);

// User Routes

// Update User
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, employeeId, email, section, phoneNumber, role, name } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: {
                username,
                employeeId,
                email,
                section,
                phoneNumber,
                role: role || 'USER',
                name
            },
            select: { id: true, username: true, employeeId: true, email: true, role: true, section: true, phoneNumber: true, name: true }
        });

        io.emit('user_update');
        res.json(user);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Username, Employee ID, or Email already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// Delete User
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // First, delete or reassign all bookings by this user
        await prisma.booking.deleteMany({ where: { userId: Number(id) } });

        // Then delete the user
        await prisma.user.delete({ where: { id: Number(id) } });
        io.emit('user_update');
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

const userRouter = express.Router();
userRouter.get('/', authenticateToken, requireAdmin, getUsers);
userRouter.post('/', authenticateToken, requireAdmin, createUser);
userRouter.put('/:id', authenticateToken, requireAdmin, updateUser);
userRouter.delete('/:id', authenticateToken, requireAdmin, deleteUser);
userRouter.post('/:id/reset-password', authenticateToken, requireAdmin, resetUserPassword);
app.use('/api/users', userRouter);

// Report Routes
const getStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.startTime = {
                gte: new Date(startDate),
                lte: new Date(endDate + 'T23:59:59.999Z')
            };
        }

        // Filter only CONFIRMED bookings for totals
        const confirmedDateFilter = { ...dateFilter, status: 'CONFIRMED' };

        const totalBookings = await prisma.booking.count({ where: confirmedDateFilter });
        const totalRooms = await prisma.room.count();
        const maintenanceRooms = await prisma.room.count({ where: { status: 'MAINTENANCE' } });

        // Calculate Total Hours & Avg Duration (Confirmed Only)
        const allBookings = await prisma.booking.findMany({
            where: confirmedDateFilter,
            select: { startTime: true, endTime: true }
        });

        let totalDurationMs = 0;
        allBookings.forEach(b => {
            totalDurationMs += new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
        });

        const totalBookingHours = (totalDurationMs / (1000 * 60 * 60)); // Convert to hours
        const averageMeetingDuration = totalBookings > 0 ? (totalBookingHours / totalBookings) : 0;

        // Group by roomId to find most popular rooms (Confirmed Only)
        const bookingsByRoom = await prisma.booking.groupBy({
            by: ['roomId'],
            where: confirmedDateFilter,
            _count: { roomId: true },
            orderBy: { _count: { roomId: 'desc' } },
            take: 5
        });

        const popularRooms = await Promise.all(bookingsByRoom.map(async item => {
            const room = await prisma.room.findUnique({ where: { id: item.roomId } });
            return {
                name: room?.name || 'Unknown',
                count: item._count.roomId
            };
        }));

        // Top Users Stats (Based on interactions - keep dateFilter but we need CONFIRMED for main count)
        const bookingsByUser = await prisma.booking.groupBy({
            by: ['userId'],
            where: confirmedDateFilter, // Rank top users by their CONFIRMED bookings
            _count: { userId: true },
            orderBy: { _count: { userId: 'desc' } },
            take: 10
        });

        const topUsers = await Promise.all(bookingsByUser.map(async item => {
            const user = await prisma.user.findUnique({ where: { id: item.userId }, select: { username: true, employeeId: true, email: true, section: true } });

            // Calculate total hours for this user (Confirmed)
            const userBookings = await prisma.booking.findMany({
                where: { userId: item.userId, ...confirmedDateFilter },
                select: { startTime: true, endTime: true }
            });
            let userDurationMs = 0;
            userBookings.forEach(b => {
                userDurationMs += new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
            });

            // Count CANCELLED bookings for this user in the period
            const cancelledCount = await prisma.booking.count({
                where: { userId: item.userId, ...dateFilter, status: 'CANCELLED' }
            });

            return {
                username: user?.username || 'Unknown',
                employeeId: user?.employeeId || '-',
                email: user?.email || '-',
                section: user?.section || '-',
                count: item._count.userId,
                cancelledCount,
                hours: (userDurationMs / (1000 * 60 * 60)).toFixed(1)
            };
        }));

        res.json({
            totalBookings,
            totalRooms,
            maintenanceRooms,
            totalBookingHours: totalBookingHours.toFixed(1),
            averageMeetingDuration: averageMeetingDuration.toFixed(1),
            popularRooms,
            topUsers
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

const getUsageStats = async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        const dateFilter = { status: 'CONFIRMED' };
        if (startDate && endDate) {
            dateFilter.startTime = {
                gte: new Date(startDate),
                lte: new Date(endDate + 'T23:59:59.999Z')
            };
        }

        const bookings = await prisma.booking.findMany({
            where: dateFilter,
            include: { room: true }
        });

        const rooms = await prisma.room.findMany();

        // Aggregate per room
        const roomStats = rooms.map(room => {
            const roomBookings = bookings.filter(b => b.roomId === room.id);
            const count = roomBookings.length;

            let totalDurationMs = 0;
            roomBookings.forEach(b => {
                totalDurationMs += new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
            });
            const totalHours = totalDurationMs / (1000 * 60 * 60);
            const avgDuration = count > 0 ? totalHours / count : 0;

            return {
                name: room.name,
                count: count,
                hours: parseFloat(totalHours.toFixed(1)),
                avg: parseFloat(avgDuration.toFixed(1))
            };
        });

        // Prepare Chart Data
        const labels = roomStats.map(r => r.name);

        const datasets = [
            {
                label: 'Total Bookings',
                data: roomStats.map(r => r.count),
                backgroundColor: 'rgba(79, 70, 229, 0.7)', // Indigo
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1
            },
            {
                label: 'Total Hours',
                data: roomStats.map(r => r.hours),
                backgroundColor: 'rgba(16, 185, 129, 0.7)', // Emerald
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1
            },
            {
                label: 'Avg Duration (h)',
                data: roomStats.map(r => r.avg),
                backgroundColor: 'rgba(245, 158, 11, 0.7)', // Amber
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 1
            }
        ];

        // Raw Data for Excel
        const rawData = roomStats.map(r => ({
            Room: r.name,
            TotalBookings: r.count,
            TotalHours: r.hours,
            AvgDuration: r.avg
        }));

        res.json({
            chartData: {
                labels,
                datasets
            },
            rawData
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch usage stats' });
    }
};

const reportRouter = express.Router();
reportRouter.get('/stats', authenticateToken, requireAdmin, getStats);
reportRouter.get('/usage', authenticateToken, requireAdmin, getUsageStats);
app.use('/api/reports', reportRouter);


// --- Serve Static Frontend (Production) ---
const frontendPath = path.join(__dirname, '../frontend/out');
if (fs.existsSync(frontendPath)) {
    console.log('Serving static frontend from:', frontendPath);
    app.use(express.static(frontendPath, { extensions: ['html'] }));

    // Handle React Routing (SPA) - Send index.html for any unknown routes (except API)
    app.use((req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
            return next();
        }
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else {
    console.log('Frontend build not found. Run "npm run build" in frontend directory.');
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
