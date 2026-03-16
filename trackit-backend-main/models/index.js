const sequelize = require('../config/database');

const Office = require('./Office');
const User = require('./User');
const DocumentType = require('./DocumentType');
const Document = require('./Document');
const StatusLog = require('./StatusLog');
const Attachment = require('./Attachment');
const DocumentRecipient = require('./DocumentRecipient');
const UserNotificationState = require('./UserNotificationState');
const PasswordResetRequest = require('./PasswordResetRequest');

// User Relationships
User.belongsTo(Office, { foreignKey: 'office_id', as: 'office' });
Office.hasMany(User, { foreignKey: 'office_id' });

// Document Type Relationships
Document.belongsTo(DocumentType, { foreignKey: 'type_id', as: 'type' });
DocumentType.hasMany(Document, { foreignKey: 'type_id' });

// Document Office Relationships
Document.belongsTo(Office, { foreignKey: 'requester_office_id', as: 'requester_office' });
Document.belongsTo(Office, { foreignKey: 'current_office_id', as: 'current_office' });

// Document User Relationships
Document.belongsTo(User, { foreignKey: 'created_by_admin_id', as: 'creator' });
Document.belongsTo(User, { foreignKey: 'completed_by_user_id', as: 'completed_by_user' });
Document.belongsTo(Office, { foreignKey: 'completed_by_office_id', as: 'completed_by_office' });

// Status Log Relationships
StatusLog.belongsTo(Document, { foreignKey: 'document_id', as: 'document' });
Document.hasMany(StatusLog, { foreignKey: 'document_id', as: 'status_history' });

StatusLog.belongsTo(Office, { foreignKey: 'from_office_id', as: 'from_office' });
StatusLog.belongsTo(Office, { foreignKey: 'to_office_id', as: 'to_office' });
StatusLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Attachment Relationships
Attachment.belongsTo(Document, { foreignKey: 'document_id', as: 'document' });
Document.hasMany(Attachment, { foreignKey: 'document_id', as: 'attachments' });

// Document Recipient Relationships
DocumentRecipient.belongsTo(Document, { foreignKey: 'document_id', as: 'document' });
Document.hasMany(DocumentRecipient, { foreignKey: 'document_id', as: 'recipients' });
DocumentRecipient.belongsTo(Office, { foreignKey: 'recipient_office_id', as: 'recipient_office' });
Office.hasMany(DocumentRecipient, { foreignKey: 'recipient_office_id', as: 'document_recipients' });

// Notification read cursor
UserNotificationState.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(UserNotificationState, { foreignKey: 'user_id', as: 'notification_state' });

// Password reset request relationships
PasswordResetRequest.belongsTo(User, { foreignKey: 'office_account_id', as: 'office_account' });
User.hasMany(PasswordResetRequest, { foreignKey: 'office_account_id', as: 'password_reset_requests' });
PasswordResetRequest.belongsTo(User, { foreignKey: 'resolved_by_admin_id', as: 'resolved_by_admin' });

module.exports = {
    sequelize,
    Office,
    User,
    PasswordResetRequest,
    DocumentType,
    Document,
    StatusLog,
    Attachment,
    DocumentRecipient,
    UserNotificationState
};
