const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

const prisma = new PrismaClient();

// Admins list (Employee IDs that should be ADMIN)
const ADMIN_IDS = ['L0202', 'TJ283', 'LE114'];

async function reimportStaff() {
    console.log('Starting staff re-import...');

    // First, delete all bookings (to avoid FK constraint)
    console.log('\nDeleting existing bookings...');
    const deleteBookings = await prisma.booking.deleteMany({});
    console.log(`Deleted: ${deleteBookings.count} bookings`);

    // Then, delete all users except 'admin'
    console.log('Deleting existing users (except admin)...');
    const deleteResult = await prisma.user.deleteMany({
        where: { NOT: { username: 'admin' } }
    });
    console.log(`Deleted: ${deleteResult.count} users`);

    // Read Excel file
    const filePath = path.join(__dirname, '../รายชื่อ Staff.xls');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    console.log('\nRaw data preview (first 3 rows):');
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

    // Find column indices based on structure:
    // ['No.', 'Emp.', <title>, 'Name', <lastname>, 'ชื่อ - นามสกุล', ...]
    // Index: 0,     1,      2,       3,       4,          5, ...
    const empColIndex = 1;      // Emp. column
    const firstNameColIndex = 3; // First Name (Name)
    const lastNameColIndex = 4;  // Last Name
    const sectionColIndex = 7;   // Section (ส่วนงาน)
    const roleColIndex = 8;      // role column in Excel

    console.log('\nColumn indices:');
    console.log('Emp:', empColIndex, '| FirstName:', firstNameColIndex, '| LastName:', lastNameColIndex, '| Section:', sectionColIndex, '| Role:', roleColIndex);

    // Process data rows
    const dataRows = rawData.slice(headerRowIndex + 1);

    let imported = 0;
    let errors = 0;

    for (const row of dataRows) {
        if (!row || !row[empColIndex]) continue; // Skip empty rows

        const employeeId = row[empColIndex]?.toString().trim();
        const firstName = row[firstNameColIndex]?.toString().trim() || '';
        const lastName = row[lastNameColIndex]?.toString().trim() || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const section = row[sectionColIndex]?.toString().trim() || '';

        // Determine role: check if in ADMIN_IDS list
        const isAdmin = ADMIN_IDS.some(id => id.toUpperCase() === employeeId.toUpperCase());
        const role = isAdmin ? 'ADMIN' : 'USER';

        // Skip if no valid employee ID
        if (!employeeId || employeeId === 'Emp.' || employeeId === 'No.') {
            continue;
        }

        const username = employeeId.toUpperCase();
        const password = employeeId.toUpperCase(); // Will be hashed
        const email = `${employeeId.toLowerCase()}@minebea.co.th`;

        try {
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    employeeId: employeeId.toUpperCase(),
                    name: fullName,
                    email,
                    section,
                    role,
                    forceChangePassword: true
                }
            });

            console.log(`OK: ${employeeId} (${fullName}) - ${role}`);
            imported++;

        } catch (error) {
            console.error(`ERROR: ${employeeId} (${fullName}) - ${error.message}`);
            errors++;
        }
    }

    console.log('\n========== IMPORT SUMMARY ==========');
    console.log(`Imported: ${imported}`);
    console.log(`Errors: ${errors}`);
    console.log(`Admins: ${ADMIN_IDS.join(', ')}`);
    console.log('=====================================');
}

reimportStaff()
    .then(() => {
        console.log('\nRe-import completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Re-import failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
