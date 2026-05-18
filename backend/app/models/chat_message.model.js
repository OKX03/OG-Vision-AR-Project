module.exports = (sequelize, Sequelize) => {
  const ChatMessage = sequelize.define("chat_message", {
    message_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    session_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    sender: {
      type: Sequelize.ENUM('user', 'model', 'function'),
      allowNull: false
    },
    content: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    intent: {
      type: Sequelize.STRING(50),
      allowNull: true
    },
    entities: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    send_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    tableName: "chat_message",
    timestamps: false,
    freezeTableName: true
  });

  return ChatMessage;
};
