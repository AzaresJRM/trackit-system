const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Document = sequelize.define('Document', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    document_code: {
        type: DataTypes.STRING
    },
    title: {
        type: DataTypes.STRING
    },
    content: {
        type: DataTypes.TEXT
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'DRAFT'
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    completed_by_user_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    completed_by_office_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    completion_remarks: {
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
    // Foreign keys type_id, requester_office_id, created_by_admin_id, current_office_id
}, {
    tableName: 'documents',
    timestamps: false
});

module.exports = Document;
