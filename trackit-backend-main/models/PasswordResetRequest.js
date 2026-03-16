const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PasswordResetRequest = sequelize.define('PasswordResetRequest', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    office_account_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    requested_identifier: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('PENDING', 'RESOLVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING'
    },
    resolved_by_admin_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    resolved_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'password_reset_requests',
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = PasswordResetRequest;
