const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attachment = sequelize.define('Attachment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    filename: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mime_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    size_bytes: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    file_data: {
        type: DataTypes.BLOB, // Maps to BYTEA in Postgres automatically via Sequelize
        allowNull: false
    },
    uploaded_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
    // Foreign keys document_id
}, {
    tableName: 'attachments',
    timestamps: false
});

module.exports = Attachment;
