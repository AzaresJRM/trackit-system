require('dotenv').config();
const { Office, User, DocumentType } = require('./models');
const sequelize = require('./config/database');

async function seedDatabase() {
    try {
        // 1. Authenticate and ensure tables exist.
        await sequelize.authenticate();
        console.log('Connected to PostgreSQL for seeding...');
        // Do NOT use alter:true here; it can fail when duplicates already exist.
        await sequelize.sync();

        // 2. Define the Offices
        const officeData = [
            { office_name: 'CSIT Office', office_code: 'CSI', description: 'Computer Science and Information Technology Department' },
            { office_name: 'CLASE Dean’s Office', office_code: 'CLA', description: 'College of Liberal Arts, Sciences, and Education' },
            { office_name: 'VPAA', office_code: 'VPA', description: 'Vice President for Academic Affairs' },
            { office_name: 'Registrar Office', office_code: 'REG', description: 'University Registrar' },
            { office_name: 'HRMO', office_code: 'HRM', description: 'Human Resource Management Office' },
            { office_name: 'Accounting Office', office_code: 'ACC', description: 'Accounting and Finance' },
            // Generic internal office for the Admin
            { office_name: 'TrackIT Admin Center', office_code: 'ADM', description: 'System Administrators' }
        ];

        console.log('Creating offices (idempotent)...');
        const createdOffices = {};
        for (const data of officeData) {
            const [office] = await Office.findOrCreate({
                where: { office_code: data.office_code },
                defaults: data
            });
            createdOffices[data.office_code] = office.id;
        }

        // 3. Define the Users (Accounts)
        // Passwords are left plain text as requested by your original backend code
        const userData = [
            // 1 Admin Account
            { username: 'admin', password: 'password123', role: 'ADMIN', office_id: createdOffices['ADM'] },

            // 6 Staff Accounts for the different departments
            { username: 'csit_staff', password: 'password123', role: 'USER', office_id: createdOffices['CSI'] },
            { username: 'clase_staff', password: 'password123', role: 'USER', office_id: createdOffices['CLA'] },
            { username: 'vpaa_staff', password: 'password123', role: 'USER', office_id: createdOffices['VPA'] },
            { username: 'registrar', password: 'password123', role: 'USER', office_id: createdOffices['REG'] },
            { username: 'hr_staff', password: 'password123', role: 'USER', office_id: createdOffices['HRM'] },
            { username: 'accounting', password: 'password123', role: 'USER', office_id: createdOffices['ACC'] }
        ];

        console.log('Creating users (idempotent)...');
        for (const data of userData) {
            await User.findOrCreate({
                where: { username: data.username },
                defaults: data
            });
        }

        // 4. Create some default Document Types for testing
        console.log('Creating document types (idempotent)...');
        const docTypes = [
            { type_name: 'Memorandum', type_code: 'MEMO', description: 'Internal Office Memo' },
            { type_name: 'Endorsement', type_code: 'ENDS', description: 'Official Endorsement Letter' },
            { type_name: 'Communication Letter', type_code: 'COMM', description: 'Official communication letter' }
        ];
        for (const data of docTypes) {
            const [docType] = await DocumentType.findOrCreate({
                where: { type_name: data.type_name },
                defaults: data
            });
            // Keep seed idempotent while ensuring canonical type_code/description are up to date.
            const needsUpdate =
                docType.type_code !== data.type_code ||
                docType.description !== data.description;
            if (needsUpdate) {
                await docType.update({
                    type_code: data.type_code,
                    description: data.description
                });
            }
        }

        console.log('\n✅ Database Seeded Successfully (idempotent)!');
        console.log('\n--- ACCOUNTS CREATED ---');
        console.log('Role   | Username     | Password      | Office');
        console.log('------------------------------------------------------');
        userData.forEach(u => {
            const officeName = officeData.find(o => createdOffices[o.office_code] === u.office_id).office_name;
            console.log(`${u.role.padEnd(6)} | ${u.username.padEnd(12)} | ${u.password.padEnd(13)} | ${officeName}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Failed to seed database:', error);
        process.exit(1);
    }
}

seedDatabase();
