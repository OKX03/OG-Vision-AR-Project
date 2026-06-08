module.exports = (sequelize, Sequelize) => {
  const Booking = sequelize.define("booking", {

    booking_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },

    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },

    product_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },

    booking_date: {
      type: Sequelize.DATEONLY,
      allowNull: false
    },

    time_slot: {
      type: Sequelize.STRING(20),
      allowNull: false
    },

    status: {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "Pending",
    },

    rejection_reason: {
      type: Sequelize.STRING(255),
      allowNull: true
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
    tableName: "booking",
    timestamps: false,
    freezeTableName: true
  });

  return Booking;
};