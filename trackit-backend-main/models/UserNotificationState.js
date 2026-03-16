const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserNotificationState = sequelize.define('UserNotificationState', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  last_seen_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_seen_log_id: {
    type: DataTypes.UUID,
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
  // Foreign key: user_id (unique)
}, {
  tableName: 'user_notification_states',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['user_id']
    }
  ]
});

module.exports = UserNotificationState;
