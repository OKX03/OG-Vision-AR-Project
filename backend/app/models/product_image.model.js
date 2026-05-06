module.exports = (sequelize, Sequelize) => {
  const ProductImage = sequelize.define("product_image", {

    image_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },

    product_id: {
      type: Sequelize.STRING(50),
      allowNull: true
    },

    image_url: {
      type: Sequelize.TEXT,
      allowNull: false
    },

    view_type: {
      type: Sequelize.STRING(50),
      allowNull: true
    },

    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },

  }, {
    tableName: "product_image",
    timestamps: false,
    createdAt: "created_at",
    freezeTableName: true
  });

  return ProductImage;
};