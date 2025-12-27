import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

async function main() {
    console.log('🗑️  Clearing existing data...');
    await prisma.booking.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('✅ Data cleared!');

    // Create Admin
    console.log('👤 Creating users...');
    const admin = await prisma.user.create({
        data: {
            username: 'admin',
            employeeId: 'EMP001',
            email: 'admin@company.com',
            password: 'admin1234',
            role: 'ADMIN',
            section: 'IT',
            phoneNumber: '081-234-5678',
            forceChangePassword: false,
        }
    });

    // Create Mock Users
    const sections = ['IT', 'HR', 'Sales', 'Marketing', 'Finance'];
    const users = [admin];
    for (let i = 1; i <= 5; i++) {
        const user = await prisma.user.create({
            data: {
                username: `user${i}`,
                employeeId: `EMP00${i + 1}`,
                email: `user${i}@company.com`,
                password: 'password123',
                role: 'USER',
                section: sections[i - 1],
                phoneNumber: `08${i}-000-000${i}`,
            }
        });
        users.push(user);
    }
    console.log(`✅ Created ${users.length} users`);

    // Create Rooms
    console.log('🏢 Creating rooms...');
    const roomsData = [
        { name: 'Meeting Room A (Small)', capacity: 4, facilities: 'Whiteboard, TV', imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80' },
        { name: 'Meeting Room B (Medium)', capacity: 8, facilities: 'Projector, Whiteboard', imageUrl: 'https://images.unsplash.com/photo-1416339442236-8ceb164046f8?auto=format&fit=crop&w=400&q=80' },
        { name: 'Conference Room (Large)', capacity: 20, facilities: 'Video Conferencing, Premium Audio, 75" Display', imageUrl: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=400&q=80' },
        { name: 'Boardroom Executive', capacity: 15, facilities: 'Video Conferencing, Catering Service', imageUrl: 'https://images.unsplash.com/photo-1572025442646-866d16c84a54?auto=format&fit=crop&w=400&q=80' },
    ];

    const rooms = [];
    for (const roomData of roomsData) {
        const room = await prisma.room.create({ data: roomData });
        rooms.push(room);
    }
    console.log(`✅ Created ${rooms.length} rooms`);

    // Create Bookings
    console.log('📅 Creating bookings...');
    const topics = ['Team Standup', 'Sprint Planning', 'Code Review', 'Design Review', 'Client Call', 'Training Session', 'Interview', 'Project Kickoff', 'Retrospective', '1-on-1 Meeting'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper to create date
    const createDate = (daysOffset: number, hour: number, minute: number = 0) => {
        const date = new Date(today);
        date.setDate(date.getDate() + daysOffset);
        date.setHours(hour, minute, 0, 0);
        return date;
    };

    // 1. Create regular single bookings for past 7 days and next 14 days
    for (let day = -7; day <= 14; day++) {
        const numBookings = 2 + Math.floor(Math.random() * 4); // 2-5 bookings per day
        for (let b = 0; b < numBookings; b++) {
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            const user = users[Math.floor(Math.random() * users.length)];
            const startHour = 8 + Math.floor(Math.random() * 9); // 8:00 - 16:00
            const duration = 1 + Math.floor(Math.random() * 2); // 1-2 hours

            try {
                await prisma.booking.create({
                    data: {
                        roomId: room.id,
                        userId: user.id,
                        startTime: createDate(day, startHour),
                        endTime: createDate(day, startHour + duration),
                        topic: topics[Math.floor(Math.random() * topics.length)],
                        isPrivate: Math.random() < 0.15,
                        pinCode: String(1000 + Math.floor(Math.random() * 9000)),
                        status: 'CONFIRMED'
                    }
                });
            } catch (error) {
                // Ignore conflicts
            }
        }
    }

    // 2. Create WEEKLY recurring bookings (with groupId)
    console.log('🔁 Creating recurring bookings...');

    // Weekly standup - every Monday for 4 weeks
    const weeklyGroup1 = crypto.randomUUID();
    for (let week = 0; week < 4; week++) {
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1 + (week * 7)); // Next Monday
        await prisma.booking.create({
            data: {
                roomId: rooms[0].id,
                userId: admin.id,
                startTime: new Date(monday.setHours(9, 0, 0, 0)),
                endTime: new Date(monday.setHours(9, 30, 0, 0)),
                topic: 'Weekly Team Standup',
                isPrivate: false,
                pinCode: '1234',
                status: 'CONFIRMED',
                recurringType: 'weekly',
                groupId: weeklyGroup1
            }
        });
    }

    // Weekly planning - every Friday for 4 weeks
    const weeklyGroup2 = crypto.randomUUID();
    for (let week = 0; week < 4; week++) {
        const friday = new Date(today);
        friday.setDate(today.getDate() - today.getDay() + 5 + (week * 7)); // Next Friday
        await prisma.booking.create({
            data: {
                roomId: rooms[2].id,
                userId: users[1].id,
                startTime: new Date(friday.setHours(14, 0, 0, 0)),
                endTime: new Date(friday.setHours(15, 30, 0, 0)),
                topic: 'Sprint Review & Planning',
                isPrivate: false,
                pinCode: '5678',
                status: 'CONFIRMED',
                recurringType: 'weekly',
                groupId: weeklyGroup2
            }
        });
    }

    // 3. Create DAILY recurring booking for 5 days
    const dailyGroup = crypto.randomUUID();
    for (let d = 1; d <= 5; d++) {
        await prisma.booking.create({
            data: {
                roomId: rooms[1].id,
                userId: admin.id,
                startTime: createDate(d, 10, 0),
                endTime: createDate(d, 10, 30),
                topic: 'Daily Scrum',
                isPrivate: false,
                pinCode: '0000',
                status: 'CONFIRMED',
                recurringType: 'daily',
                groupId: dailyGroup
            }
        });
    }

    // 4. Create some cancelled bookings for stats
    console.log('❌ Creating cancelled bookings...');
    for (let i = 0; i < 10; i++) {
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        const user = users[Math.floor(Math.random() * users.length)];
        const day = -Math.floor(Math.random() * 14); // Past 14 days

        try {
            await prisma.booking.create({
                data: {
                    roomId: room.id,
                    userId: user.id,
                    startTime: createDate(day, 11),
                    endTime: createDate(day, 12),
                    topic: `Cancelled: ${topics[Math.floor(Math.random() * topics.length)]}`,
                    isPrivate: false,
                    pinCode: '0000',
                    status: 'CANCELLED'
                }
            });
        } catch (error) { }
    }

    const totalBookings = await prisma.booking.count();
    console.log(`✅ Created ${totalBookings} bookings (including recurring)`);

    console.log('\n🎉 Seed completed successfully!');
    console.log(`   Admin login: admin / admin1234`);
    console.log(`   User login: user1 / password123`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
