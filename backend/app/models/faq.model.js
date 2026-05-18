module.exports = (sequelize, Sequelize) => {
  const FAQ = sequelize.define("faq", {

    faq_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },

    category: {
      type: Sequelize.STRING(50),
      allowNull: false
    },

    question: {
      type: Sequelize.TEXT,
      allowNull: false
    },

    answer: {
      type: Sequelize.TEXT,
      allowNull: false
    },  

    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
    },

    updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        onUpdate: Sequelize.literal("CURRENT_TIMESTAMP")
    }


  }, {
    tableName: "faq",
    timestamps: false,
    freezeTableName: true
  });

  return FAQ;
};