const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentRecipient = sequelize.define('DocumentRecipient', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    recipient_status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'RELEASED'
    },
    last_action_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    received_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    declined_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    latest_remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
    // Foreign keys: document_id, recipient_office_id
}, {
    tableName: 'document_recipients',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['document_id', 'recipient_office_id']
        }
    ]
});

module.exports = DocumentRecipient;
