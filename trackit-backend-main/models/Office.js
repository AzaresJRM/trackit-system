const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Office = sequelize.define('Office', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    office_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    office_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'offices',
    timestamps: false
});

module.exports = Office;
