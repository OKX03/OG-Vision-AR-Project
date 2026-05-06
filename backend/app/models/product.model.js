const { INTEGER } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const Product = sequelize.define("product", {

    product_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },

    model: {
      type: Sequelize.STRING(100),
      allowNull: false
    },

    brand: {
      type: Sequelize.STRING(50),
      allowNull: false
    },

    price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    },

    gender: {
      type: Sequelize.STRING(10),
      allowNull: true
    },

    frame_size: {
      type: Sequelize.STRING(20),
      allowNull: true
    },

    lens_width: {
      type: Sequelize.INTEGER,
      allowNull: true
    },

    lens_height: {
      type: Sequelize.INTEGER,
      allowNull: true
    },

    bridge_width: {
      type: Sequelize.INTEGER,
      allowNull: true
    },

    temple_length: {
      type: Sequelize.INTEGER,
      allowNull: true
    },

    frame_shape: {
      type: Sequelize.STRING(50),
      allowNull: true
    },

    frame_material: {
      type: Sequelize.STRING(50),
      allowNull: true
    },

    color: {
      type: Sequelize.STRING(50),
      allowNull: true
    },

    face_shape: {
      type: Sequelize.TEXT,
      allowNull: true
    },

    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },

    quantity: {
      type: Sequelize.INTEGER,
      allowNull: false
    },

    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },

    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    }

  }, {
    tableName: "product",
    timestamps: false,
    createdAt: "created_at",
    updatedAt: "updated_at",
    freezeTableName: true
  });

  return Product;
};