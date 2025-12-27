const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const bookings = await prisma.booking.findMany({
        include: { room: true, user: true }
    });
    console.log('Total Bookings:', bookings.length);
    console.log(JSON.stringify(bookings, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
