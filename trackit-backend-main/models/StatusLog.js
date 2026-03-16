const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StatusLog = sequelize.define('StatusLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    status: {
        type: DataTypes.STRING
    },
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    remarks: {
        type: DataTypes.TEXT
    }
    // Foreign keys document_id, from_office_id, to_office_id, user_id
}, {
    tableName: 'status_history',
    timestamps: false
});

module.exports = StatusLog;
