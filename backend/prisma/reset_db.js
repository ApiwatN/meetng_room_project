const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🗑️ Deleting all existing data...');

    // Delete in order (respect foreign keys)
    await prisma.booking.deleteMany();
    await prisma.user.deleteMany();
    await prisma.room.deleteMany();

    console.log('✅ All data deleted');

    // Create admin user
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin', 10);
    await prisma.user.create({
        data: {
            username: 'admin',
            password: hashedPassword,
            role: 'ADMIN',
            forceChangePassword: false,
            employeeId: 'ADMIN001',
            email: 'admin@company.com',
            section: 'IT',
            phoneNumber: '0000'
        }
    });

    // Create rooms
    console.log('🏢 Creating rooms...');
    await prisma.room.create({
        data: {
            name: 'Conference',
            capacity: 20,
            facilities: 'Projector, Whiteboard, Video Conference',
            status: 'AVAILABLE',
            imageUrl: null
        }
    });

    await prisma.room.create({
        data: {
            name: 'Meeting_1',
            capacity: 10,
            facilities: 'Projector, Whiteboard',
            status: 'AVAILABLE',
            imageUrl: null
        }
    });

    console.log('');
    console.log('✅ Database reset complete!');
    console.log('');
    console.log('📋 Created:');
    console.log('   User: admin (password: admin)');
    console.log('   Rooms: Conference, Meeting_1');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
