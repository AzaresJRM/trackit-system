require('dotenv').config();

const { sequelize } = require('../models');

async function addConstraintIfMissing(queryInterface, table, fields, name) {
  try {
    await queryInterface.addConstraint(table, {
      type: 'unique',
      fields,
      name
    });
    console.log(`Added unique constraint "${name}" on ${table}(${fields.join(', ')}).`);
  } catch (err) {
    // If the constraint already exists, Postgres will throw an error we can safely ignore.
    if (err && err.message && err.message.includes('already exists')) {
      console.log(`Constraint "${name}" already exists on ${table}, skipping.`);
    } else {
      throw err;
    }
  }
}

async function run() {
  console.log('Adding unique constraints for offices, users, and document_types...');
  const queryInterface = sequelize.getQueryInterface();
  try {
    await addConstraintIfMissing(
      queryInterface,
      'offices',
      ['office_code'],
      'offices_office_code_unique'
    );

    await addConstraintIfMissing(
      queryInterface,
      'users',
      ['username'],
      'users_username_unique'
    );

    await addConstraintIfMissing(
      queryInterface,
      'document_types',
      ['type_name'],
      'document_types_type_name_unique'
    );

    console.log('✅ Unique constraints added successfully.');
  } catch (err) {
    if (err && err.name === 'SequelizeUniqueConstraintError') {
      console.error('❌ Cannot add unique constraints yet because duplicate rows still exist.');
      console.error('Run: node scripts/cleanupDuplicates.js');
    }
    console.error('❌ Failed to add unique constraints:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();

