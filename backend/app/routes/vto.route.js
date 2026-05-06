const { authJwt } = require("../middleware/index.js");

module.exports = app => {
  const vto = require("../controllers/vto.controller.js");
  const router = require("express").Router();
  const multer = require("multer");
  const path = require("path");

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "public/models"); 
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });

  const upload = multer({ storage });

  router.post(
    "/:product_id",
    [authJwt.verifyToken, authJwt.isAdmin],
    upload.single("vto_model"),
    vto.uploadModel
  );

  router.delete(
    "/:product_id",
    [authJwt.verifyToken, authJwt.isAdmin],
    vto.deleteModel
  );

  router.get(
    "/:product_id", 
    vto.getModelByProductId
  );

   router.put(
    "/:product_id/calibration",
    [authJwt.verifyToken, authJwt.isAdmin],
    vto.saveCalibration
  );

  app.use("/api/vto", router);
};