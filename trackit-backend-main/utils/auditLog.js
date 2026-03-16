const { StatusLog } = require('../models');

const AUDIT_ACTIONS = {
  FORWARDED: 'FORWARDED',
  RECEIVED: 'RECEIVED',
  DECLINED: 'DECLINED',
  RETURNED: 'RETURNED',
  EDITED: 'EDITED',
  COMPLETED: 'COMPLETED',
  ATTACHMENT_REPLACED: 'ATTACHMENT REPLACED',
  ATTACHMENT_ADDED: 'ATTACHMENT ADDED',
  ATTACHMENT_REMOVED: 'ATTACHMENT REMOVED',
  CANCELLED: 'CANCELLED'
};

function normalizeNullable(value) {
  return value === undefined ? null : value;
}

function normalizeRemarks(remarks) {
  const value = String(remarks || '').trim();
  return value || null;
}

async function createAuditLog({
  documentId,
  status,
  userId = null,
  fromOfficeId = null,
  toOfficeId = null,
  remarks = null,
  timestamp = new Date(),
  transaction = undefined
}) {
  if (!documentId) throw new Error('createAuditLog requires documentId');
  if (!status || !String(status).trim()) throw new Error('createAuditLog requires status');

  return StatusLog.create({
    document_id: documentId,
    status: String(status).trim(),
    user_id: normalizeNullable(userId),
    from_office_id: normalizeNullable(fromOfficeId),
    to_office_id: normalizeNullable(toOfficeId),
    date: timestamp || new Date(),
    remarks: normalizeRemarks(remarks)
  }, transaction ? { transaction } : undefined);
}

module.exports = {
  AUDIT_ACTIONS,
  createAuditLog
};
