require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");


const app = express();

var corsOptions = {
  credentials: true,
  origin: true
};

app.disable("x-powered-by");
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/images', express.static('public/images'));
app.use('/models', express.static('public/models'));

// Import routes
require("./app/routes/product.route")(app);
require("./app/routes/user.route")(app);
require("./app/routes/vto.route")(app);
require("./app/routes/booking.route")(app);
require("./app/routes/faq.route")(app);
require("./app/routes/chatbot.route")(app);
require("./app/cron/booking.cron"); 

// set port, listen for requests
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

// Sequelize DB sync
const db = require("./app/models");

db.sequelize.sync({ force: false })
  .then(() => {
    console.log("Synced db.");
    // initial();
  })
  .catch((err) => {
    console.log("Failed to sync db: " + err.message);
  });

