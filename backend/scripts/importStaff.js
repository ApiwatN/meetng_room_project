const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

const prisma = new PrismaClient();

async function importStaff() {
    console.log('Starting staff import...');

    // Read Excel file
    const filePath = path.join(__dirname, '../รายชื่อ Staff.xls');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    console.log('Raw data preview (first 3 rows):');
    console.log(rawData.slice(0, 3));

    // Find header row (look for "Emp." column)
    let headerRowIndex = 0;
    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (row && row.some(cell => cell && cell.toString().includes('Emp'))) {
            headerRowIndex = i;
            break;
        }
    }

    const headers = rawData[headerRowIndex];
    console.log('\nHeaders found:', headers);

    // Find column indices
    const empColIndex = headers.findIndex(h => h && h.toString().includes('Emp'));
    const nameColIndex = headers.findIndex(h => h && h.toString() === 'Name');
    const sectionColIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('section'));
    const roleColIndex = headers.findIndex(h => h && h.toString().toLowerCase() === 'user');

    console.log('\nColumn indices:');
    console.log('Emp:', empColIndex, '| Name:', nameColIndex, '| Section:', sectionColIndex, '| Role:', roleColIndex);

    // Process data rows
    const dataRows = rawData.slice(headerRowIndex + 1);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of dataRows) {
        if (!row || !row[empColIndex]) continue; // Skip empty rows

        const employeeId = row[empColIndex]?.toString().trim();
        const name = row[nameColIndex]?.toString().trim() || '';
        const section = row[sectionColIndex]?.toString().trim() || '';
        const roleRaw = row[roleColIndex]?.toString().trim().toUpperCase() || 'USER';
        const role = roleRaw === 'ADMIN' ? 'ADMIN' : 'USER';

        // Skip if no valid employee ID
        if (!employeeId || employeeId === 'Emp.' || employeeId === 'No.') {
            continue;
        }

        const username = employeeId.toUpperCase();
        const password = employeeId.toUpperCase(); // Will be hashed
        const email = `${employeeId.toLowerCase()}@minebea.co.th`;

        try {
            // Check if user already exists
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { username: username },
                        { employeeId: employeeId },
                        { email: email }
                    ]
                }
            });

            if (existingUser) {
                console.log(`SKIP: ${employeeId} (${name}) - already exists`);
                skipped++;
                continue;
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    employeeId,
                    name,
                    email,
                    section,
                    role,
                    forceChangePassword: true
                }
            });

            console.log(`OK: ${employeeId} (${name}) - ${role}`);
            imported++;

        } catch (error) {
            console.error(`ERROR: ${employeeId} (${name}) - ${error.message}`);
            errors++;
        }
    }

    console.log('\n========== IMPORT SUMMARY ==========');
    console.log(`Imported: ${imported}`);
    console.log(`Skipped (already exists): ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('=====================================');
}

importStaff()
    .then(() => {
        console.log('\nImport completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Import failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
