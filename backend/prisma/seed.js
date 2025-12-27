const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🗑️ Deleting existing data...');

    // Delete in order (respect foreign keys)
    await prisma.booking.deleteMany();
    await prisma.user.deleteMany();
    await prisma.room.deleteMany();

    console.log('✅ Existing data deleted');

    // Create sample rooms
    console.log('🏢 Creating rooms...');
    const rooms = await Promise.all([
        prisma.room.create({
            data: {
                name: 'Meeting Room A (Small)',
                capacity: 6,
                facilities: 'Projector, Whiteboard, TV',
                status: 'AVAILABLE',
                imageUrl: null
            }
        }),
        prisma.room.create({
            data: {
                name: 'Meeting Room B (Medium)',
                capacity: 12,
                facilities: 'Projector, Whiteboard, TV, Video Conference',
                status: 'AVAILABLE',
                imageUrl: null
            }
        }),
        prisma.room.create({
            data: {
                name: 'Meeting Room C (Large)',
                capacity: 20,
                facilities: 'Projector, Whiteboard, TV, Video Conference, Sound System',
                status: 'AVAILABLE',
                imageUrl: null
            }
        }),
        prisma.room.create({
            data: {
                name: 'Training Room',
                capacity: 30,
                facilities: 'Projector, Whiteboard, TV, Computers (15 sets), Sound System',
                status: 'AVAILABLE',
                imageUrl: null
            }
        }),
        prisma.room.create({
            data: {
                name: 'VIP Room',
                capacity: 8,
                facilities: 'Premium TV, Video Conference, Mini Bar, Air Purifier',
                status: 'AVAILABLE',
                imageUrl: null
            }
        })
    ]);
    console.log(`✅ Created ${rooms.length} rooms`);

    // Create sample users with Thai names
    console.log('👥 Creating users...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    const users = await Promise.all([
        prisma.user.create({
            data: {
                username: 'admin',
                employeeId: 'EMP-001',
                email: 'admin@company.com',
                name: 'ผู้ดูแลระบบ',
                password: hashedPassword,
                role: 'ADMIN',
                section: 'IT',
                phoneNumber: '081-234-5678',
                forceChangePassword: false
            }
        }),
        prisma.user.create({
            data: {
                username: 'somchai',
                employeeId: 'EMP-002',
                email: 'somchai@company.com',
                name: 'สมชาย ใจดี',
                password: hashedPassword,
                role: 'USER',
                section: 'Sales',
                phoneNumber: '082-345-6789',
                forceChangePassword: false
            }
        }),
        prisma.user.create({
            data: {
                username: 'somying',
                employeeId: 'EMP-003',
                email: 'somying@company.com',
                name: 'สมหญิง รักงาน',
                password: hashedPassword,
                role: 'USER',
                section: 'HR',
                phoneNumber: '083-456-7890',
                forceChangePassword: false
            }
        }),
        prisma.user.create({
            data: {
                username: 'prasit',
                employeeId: 'EMP-004',
                email: 'prasit@company.com',
                name: 'ประสิทธิ์ มั่นคง',
                password: hashedPassword,
                role: 'USER',
                section: 'Engineering',
                phoneNumber: '084-567-8901',
                forceChangePassword: false
            }
        }),
        prisma.user.create({
            data: {
                username: 'nattaya',
                employeeId: 'EMP-005',
                email: 'nattaya@company.com',
                name: 'ณัฐยา สว่างจิต',
                password: hashedPassword,
                role: 'USER',
                section: 'Marketing',
                phoneNumber: '085-678-9012',
                forceChangePassword: false
            }
        }),
        prisma.user.create({
            data: {
                username: 'wichai',
                employeeId: 'EMP-006',
                email: 'wichai@company.com',
                name: 'วิชัย เก่งกาจ',
                password: hashedPassword,
                role: 'USER',
                section: 'Finance',
                phoneNumber: '086-789-0123',
                forceChangePassword: false
            }
        })
    ]);
    console.log(`✅ Created ${users.length} users`);

    // Create sample bookings for next 7 days
    console.log('📅 Creating bookings...');

    const now = new Date();
    const bookings = [];

    // Today's bookings
    const todayStart = new Date(now);
    todayStart.setHours(9, 0, 0, 0);

    // Room A - Today 09:00-10:00
    bookings.push({
        roomId: rooms[0].id,
        userId: users[1].id,
        startTime: new Date(todayStart),
        endTime: new Date(new Date(todayStart).setHours(10, 0)),
        topic: 'Daily Standup Meeting',
        isPrivate: false,
        pinCode: '1234',
        status: 'CONFIRMED'
    });

    // Room A - Today 14:00-15:00
    const today14 = new Date(now);
    today14.setHours(14, 0, 0, 0);
    bookings.push({
        roomId: rooms[0].id,
        userId: users[2].id,
        startTime: new Date(today14),
        endTime: new Date(new Date(today14).setHours(15, 0)),
        topic: 'HR Interview',
        isPrivate: true,
        pinCode: '2345',
        status: 'CONFIRMED'
    });

    // Room B - Today 10:00-12:00
    const today10 = new Date(now);
    today10.setHours(10, 0, 0, 0);
    bookings.push({
        roomId: rooms[1].id,
        userId: users[3].id,
        startTime: new Date(today10),
        endTime: new Date(new Date(today10).setHours(12, 0)),
        topic: 'Engineering Review',
        isPrivate: false,
        pinCode: '3456',
        status: 'CONFIRMED'
    });

    // Room C - Today 13:00-15:00
    const today13 = new Date(now);
    today13.setHours(13, 0, 0, 0);
    bookings.push({
        roomId: rooms[2].id,
        userId: users[4].id,
        startTime: new Date(today13),
        endTime: new Date(new Date(today13).setHours(15, 0)),
        topic: 'Marketing Campaign Planning',
        isPrivate: false,
        pinCode: '4567',
        status: 'CONFIRMED'
    });

    // Tomorrow's bookings
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    bookings.push({
        roomId: rooms[0].id,
        userId: users[1].id,
        startTime: new Date(tomorrow),
        endTime: new Date(new Date(tomorrow).setHours(10, 30)),
        topic: 'Sales Team Weekly',
        isPrivate: false,
        pinCode: '5678',
        status: 'CONFIRMED'
    });

    const tomorrow11 = new Date(tomorrow);
    tomorrow11.setHours(11, 0);
    bookings.push({
        roomId: rooms[1].id,
        userId: users[5].id,
        startTime: new Date(tomorrow11),
        endTime: new Date(new Date(tomorrow11).setHours(12, 0)),
        topic: 'Budget Review Q1',
        isPrivate: true,
        pinCode: '6789',
        status: 'CONFIRMED'
    });

    // Day after tomorrow
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(14, 0, 0, 0);

    bookings.push({
        roomId: rooms[3].id,
        userId: users[3].id,
        startTime: new Date(dayAfter),
        endTime: new Date(new Date(dayAfter).setHours(17, 0)),
        topic: 'New Employee Training',
        isPrivate: false,
        pinCode: '7890',
        status: 'CONFIRMED'
    });

    // VIP Room - Special meeting
    const vipMeeting = new Date(now);
    vipMeeting.setDate(vipMeeting.getDate() + 3);
    vipMeeting.setHours(10, 0, 0, 0);

    bookings.push({
        roomId: rooms[4].id,
        userId: users[0].id,
        startTime: new Date(vipMeeting),
        endTime: new Date(new Date(vipMeeting).setHours(12, 0)),
        topic: 'Executive Board Meeting',
        isPrivate: true,
        pinCode: '8901',
        status: 'CONFIRMED'
    });

    // Create all bookings
    for (const booking of bookings) {
        await prisma.booking.create({ data: booking });
    }
    console.log(`✅ Created ${bookings.length} bookings`);

    console.log('\n🎉 Sample data created successfully!');
    console.log('\n📋 Login credentials (all users):');
    console.log('   Password: password123');
    console.log('\n👤 Sample users:');
    users.forEach(u => {
        console.log(`   • ${u.username} (${u.name}) - ${u.role} - ${u.section}`);
    });
}

main()
    .catch(e => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
