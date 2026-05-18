module.exports = (sequelize, Sequelize) => {
  const ChatSession = sequelize.define("chat_session", {
    session_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    start_time: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    end_time: {
      type: Sequelize.DATE,
      allowNull: true
    }
  }, {
    tableName: "chat_session",
    timestamps: false,
    freezeTableName: true
  });

  return ChatSession;
};
