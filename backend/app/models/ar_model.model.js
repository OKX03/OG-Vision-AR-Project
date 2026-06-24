module.exports = (sequelize, Sequelize) => {
  const ARModel = sequelize.define("ar_model", {

    model_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },

    product_id: {
      type: Sequelize.STRING(50),
      allowNull: true
    },

    file_path: {
      type: Sequelize.TEXT,
      allowNull: false
    },

    uploaded_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    pitch: {
      type: Sequelize.FLOAT,
      defaultValue: 0
    },
    yaw: {
      type: Sequelize.FLOAT,
      defaultValue: 0
    },
    roll: {
      type: Sequelize.FLOAT,
      defaultValue: 0
    },
    scale: {
      type: Sequelize.FLOAT,
      defaultValue: 1.0
    },
    y_offset: {
      type: Sequelize.FLOAT,
      defaultValue: 0
    },
    z_offset: {
      type: Sequelize.FLOAT,
      defaultValue: 0
    }
  }, {
    tableName: "ar_model",
    timestamps: false,
    createdAt: "uploaded_at",
    freezeTableName: true
  });

  return ARModel;
};