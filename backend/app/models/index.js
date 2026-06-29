const dbConfig = require("../config/db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  operatorsAliases: false,
  dialectOptions: {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  },
  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle
  }
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.product = require("./product.model.js")(sequelize, Sequelize);
db.product_image = require("./product_image.model.js")(sequelize, Sequelize);
db.ar_model = require("./ar_model.model.js")(sequelize, Sequelize);
db.user = require("./user.model.js")(sequelize, Sequelize);
db.booking = require("./booking.model.js")(sequelize, Sequelize);
db.faq = require("./faq.model.js")(sequelize, Sequelize); 
db.chat_session = require("./chat_session.model.js")(sequelize, Sequelize);
db.chat_message = require("./chat_message.model.js")(sequelize, Sequelize);

db.product.hasMany(db.product_image, {
  foreignKey: "product_id",
  sourceKey: "product_id",
  as: "images"
});

db.product_image.belongsTo(db.product, {
  foreignKey: "product_id",
  targetKey: "product_id",
  as: "product"
});

db.product.hasOne(db.ar_model, {
  foreignKey: "product_id",
  sourceKey: "product_id",
  as: "ar_model"
});

db.ar_model.belongsTo(db.product, {
  foreignKey: "product_id",
  targetKey: "product_id",
  as: "product"
});

db.user.hasMany(db.booking, {
  foreignKey: "user_id",
  sourceKey: "user_id",
  as: "bookings"
});

db.booking.belongsTo(db.user, {
  foreignKey: "user_id",
  targetKey: "user_id",
  as: "user"
});

db.product.hasMany(db.booking, {
  foreignKey: "product_id",
  sourceKey: "product_id",
  as: "bookings"
});

db.booking.belongsTo(db.product, {
  foreignKey: "product_id",
  targetKey: "product_id",
  as: "product"
});

db.user.hasMany(db.chat_session, {
  foreignKey: "user_id",
  sourceKey: "user_id",
  as: "chat_sessions"
});

db.chat_session.belongsTo(db.user, {
  foreignKey: "user_id",
  targetKey: "user_id",
  as: "user"
});

db.chat_session.hasMany(db.chat_message, {
  foreignKey: "session_id",
  sourceKey: "session_id",
  as: "messages"
});

db.chat_message.belongsTo(db.chat_session, {
  foreignKey: "session_id",
  targetKey: "session_id",
  as: "session"
});

module.exports = db;