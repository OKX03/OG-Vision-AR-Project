const { authJwt } = require("../middleware/index.js");
const vto = require("../controllers/vto.controller.js");
const router = require("express").Router();
const multer = require("multer");

// FIX: Use 'node:' prefix for built-in modules (Maintainability Issue)
const path = require("node:path"); 

const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  }
});

// FIX: Added 'limits' to prevent massive file uploads (Security Issue)
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.R2_BUCKET_NAME || 'og-vision-ar',
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, `models/model_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for 3D assets
});

// FIX: Named the arrow function (Maintainability Issue)
const vtoRoutes = app => {
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

module.exports = vtoRoutes;