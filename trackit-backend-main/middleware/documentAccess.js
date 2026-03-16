const { Op } = require('sequelize');
const { Document, StatusLog, DocumentRecipient } = require('../models');

async function userCanAccessDocument(userRecord, documentId) {
  if (!userRecord || !documentId) return false;
  const officeId = userRecord.office_id;
  const userId = userRecord.id;

  const doc = await Document.findOne({
    where: {
      id: documentId,
      [Op.or]: [
        { requester_office_id: officeId },
        { current_office_id: officeId }
      ]
    },
    attributes: ['id'],
    raw: true
  });
  if (doc) return true;

  const recipientRow = await DocumentRecipient.findOne({
    where: {
      document_id: documentId,
      recipient_office_id: officeId
    },
    attributes: ['id'],
    raw: true
  });
  if (recipientRow) return true;

  const historyRow = await StatusLog.findOne({
    where: {
      document_id: documentId,
      [Op.or]: [
        { from_office_id: officeId },
        { to_office_id: officeId },
        { user_id: userId }
      ]
    },
    attributes: ['id'],
    raw: true
  });
  return Boolean(historyRow);
}

module.exports = {
  userCanAccessDocument
};
