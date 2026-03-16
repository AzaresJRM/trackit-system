require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, Office, User, DocumentType, Document, StatusLog } = require('../models');

async function cleanupOffices(transaction) {
  console.log('--- Cleaning duplicate offices by office_code ---');
  const [rows] = await sequelize.query(
    `
      SELECT office_code, array_agg(id ORDER BY id) AS ids
      FROM offices
      GROUP BY office_code
      HAVING COUNT(*) > 1
    `,
    { transaction }
  );

  for (const row of rows) {
    const code = row.office_code;
    const ids = row.ids;
    const keepId = ids[0];
    const duplicateIds = ids.slice(1);
    if (duplicateIds.length === 0) continue;

    console.log(`Office "${code}" duplicates: keeping ${keepId}, removing [${duplicateIds.join(', ')}]`);

    // Re-point foreign keys that reference offices
    await User.update(
      { office_id: keepId },
      { where: { office_id: { [Op.in]: duplicateIds } }, transaction }
    );
    await Document.update(
      { requester_office_id: keepId },
      { where: { requester_office_id: { [Op.in]: duplicateIds } }, transaction }
    );
    await Document.update(
      { current_office_id: keepId },
      { where: { current_office_id: { [Op.in]: duplicateIds } }, transaction }
    );
    await StatusLog.update(
      { from_office_id: keepId },
      { where: { from_office_id: { [Op.in]: duplicateIds } }, transaction }
    );
    await StatusLog.update(
      { to_office_id: keepId },
      { where: { to_office_id: { [Op.in]: duplicateIds } }, transaction }
    );
    await Office.destroy({
      where: { id: { [Op.in]: duplicateIds } },
      transaction
    });
  }
}

async function cleanupUsers(transaction) {
  console.log('--- Cleaning duplicate users by username ---');
  const [rows] = await sequelize.query(
    `
      SELECT username, array_agg(id ORDER BY id) AS ids
      FROM users
      GROUP BY username
      HAVING COUNT(*) > 1
    `,
    { transaction }
  );

  for (const row of rows) {
    const username = row.username;
    const ids = row.ids;
    const keepId = ids[0];
    const duplicateIds = ids.slice(1);
    if (duplicateIds.length === 0) continue;

    console.log(`User "${username}" duplicates: keeping ${keepId}, removing [${duplicateIds.join(', ')}]`);

    await Document.update(
      { created_by_admin_id: keepId },
      { where: { created_by_admin_id: { [Op.in]: duplicateIds } }, transaction }
    );
    await StatusLog.update(
      { user_id: keepId },
      { where: { user_id: { [Op.in]: duplicateIds } }, transaction }
    );
    await User.destroy({
      where: { id: { [Op.in]: duplicateIds } },
      transaction
    });
  }
}

async function cleanupDocumentTypes(transaction) {
  console.log('--- Cleaning duplicate document types by type_name ---');
  const [rows] = await sequelize.query(
    `
      SELECT type_name, array_agg(id ORDER BY id) AS ids
      FROM document_types
      GROUP BY type_name
      HAVING COUNT(*) > 1
    `,
    { transaction }
  );

  for (const row of rows) {
    const typeName = row.type_name;
    const ids = row.ids;
    const keepId = ids[0];
    const duplicateIds = ids.slice(1);
    if (duplicateIds.length === 0) continue;

    console.log(`Document type "${typeName}" duplicates: keeping ${keepId}, removing [${duplicateIds.join(', ')}]`);

    await Document.update(
      { type_id: keepId },
      { where: { type_id: { [Op.in]: duplicateIds } }, transaction }
    );
    await DocumentType.destroy({
      where: { id: { [Op.in]: duplicateIds } },
      transaction
    });
  }
}

async function run() {
  console.log('Starting duplicate cleanup...');
  const transaction = await sequelize.transaction();
  try {
    await cleanupOffices(transaction);
    await cleanupUsers(transaction);
    await cleanupDocumentTypes(transaction);

    await transaction.commit();
    console.log('✅ Duplicate cleanup completed successfully.');
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Duplicate cleanup failed, transaction rolled back.', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();

