const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentType = sequelize.define('DocumentType', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    type_name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    type_code: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    description: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'document_types',
    timestamps: false
});

module.exports = DocumentType;
