const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'USER'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    must_change_password: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
    // office_id is added in associations (index.js)
}, {
    tableName: 'users',
    timestamps: false
});

module.exports = User;
