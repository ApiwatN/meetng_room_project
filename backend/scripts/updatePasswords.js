const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

const prisma = new PrismaClient();

async function updatePasswords() {
    console.log('Updating all user passwords to uppercase hashes...');

    // Read Excel file to get Employee IDs
    const filePath = path.join(__dirname, '../รายชื่อ Staff.xls');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Find header row
    let headerRowIndex = 0;
    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (row && row.some(cell => cell && cell.toString().includes('Emp'))) {
            headerRowIndex = i;
            break;
        }
    }

    const headers = rawData[headerRowIndex];
    const empColIndex = headers.findIndex(h => h && h.toString().includes('Emp'));

    const dataRows = rawData.slice(headerRowIndex + 1);

    let updated = 0;
    let errors = 0;

    for (const row of dataRows) {
        if (!row || !row[empColIndex]) continue;

        const employeeId = row[empColIndex]?.toString().trim();
        if (!employeeId || employeeId === 'Emp.' || employeeId === 'No.') continue;

        const username = employeeId.toUpperCase();
        const password = employeeId.toUpperCase();

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.updateMany({
                where: { username: username },
                data: { password: hashedPassword }
            });
            console.log(`Updated: ${username}`);
            updated++;
        } catch (error) {
            console.error(`Error updating ${username}:`, error.message);
            errors++;
        }
    }

    // Also update admin user
    try {
        const adminHash = await bcrypt.hash('ADMIN', 10);
        await prisma.user.update({
            where: { username: 'admin' },
            data: { password: adminHash }
        });
        console.log('Updated: admin');
        updated++;
    } catch (error) {
        console.log('Admin user not found or already correct');
    }

    console.log(`\n========== UPDATE SUMMARY ==========`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`====================================`);
}

updatePasswords()
    .then(() => {
        console.log('\nPassword update completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Update failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
