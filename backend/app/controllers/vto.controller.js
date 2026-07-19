const db = require("../models");
const ARModel = db.ar_model;

const fs = require("fs");
const path = require("path");
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  }
});

// FIX: Helper function to handle VTO model deletion from R2 or local storage (Maintainability Issue)
// Helper function to delete an old AR model file from cloud storage (Cloudflare R2).
const deleteOldVtoModel = async (oldFilePath) => {
  if (oldFilePath.includes('r2.dev') || oldFilePath.includes(process.env.R2_PUBLIC_URL)) {
    const oldKey = oldFilePath.split('/').slice(-2).join('/');
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME || 'og-vision-ar', Key: oldKey }));
    } catch (e) {
      console.warn("Could not delete old R2 model:", e.message);
    }
  } else if (!oldFilePath.includes('cloudinary.com')) {
    const oldPath = path.resolve(__dirname, "..", "..", "public", oldFilePath.replace(/^\/+/, ""));
    if (fs.existsSync(oldPath)) {
      try { 
        fs.unlinkSync(oldPath); 
      } 
      catch (fsErr) {
        console.warn("Skipped deleting local file (may not exist):", fsErr.message); // FIX
      }
    }
  }
};

// Controller action to handle uploading a new 3D AR model for a product.
exports.uploadModel = async (req, res) => {
  try {

    console.log("Received file:", req.file);

    const product_id = req.params.product_id;

    if (!req.file) {
      return res.status(400).send({
        message: "No file uploaded"
      });
    }

    let model = await ARModel.findOne({
      where: { product_id }
    });

    const filePath = `${process.env.R2_PUBLIC_URL}/${req.file.key}`;

    if (model) {
      const oldFilePath = model.file_path;
      await model.update({ file_path: filePath });
      await deleteOldVtoModel(oldFilePath);

      return res.send({
        message: "AR model updated",
        model
      });

    } else {

      model = await ARModel.create({
        product_id,
        file_path: filePath
      });

      return res.send({
        message: "AR model uploaded",
        model
      });
    }

  } catch (err) {

    console.error("UPLOAD ERROR:", err);

    return res.status(500).send({
      message: "Server error",
      error: err.message
    });
  }
};

// Controller action to delete an AR model.
exports.deleteModel = async (req, res) => {
  try {

    const product_id = req.params.product_id;

    const model = await ARModel.findOne({
      where: { product_id }
    });

    if (!model) {
      return res.status(404).send({
        message: "Model not found"
      });
    }

    await deleteOldVtoModel(model.file_path);
    await model.destroy();

    return res.send({
      message: "Deleted successfully"
    });

  } catch (err) {

    console.error(err);

    return res.status(500).send({
      message: "Server error",
      error: err.message
    });
  }
};

// Controller action to retrieve AR model details for a specific product.
exports.getModelByProductId = async (req, res) => {
  try {

    const product_id = req.params.product_id;

    const model = await ARModel.findOne({
      where: { product_id }
    });

    if (!model) {
      return res.status(404).send({
        message: "Model not found"
      });
    }

    return res.send(model);

  } catch (err) {

    console.error(err);

    return res.status(500).send({
      message: "Server error",
      error: err.message
    });
  }
};

// Controller action to save calibration settings for an AR model.
exports.saveCalibration = async (req, res) => {
  try {

    const product_id = req.params.product_id;

    const {
      pitch,
      yaw,
      roll,
      scale,
      yOffset,
      zOffset
    } = req.body;

    const model = await ARModel.findOne({
      where: { product_id }
    });

    if (!model) {
      return res.status(404).send({
        message: "Model not found"
      });
    }

    await model.update({
      pitch,
      yaw,
      roll,
      scale,
      y_offset: yOffset,
      z_offset: zOffset
    });

    return res.send({
      message: "Calibration saved successfully"
    });

  } catch (err) {

    console.error(err);

    return res.status(500).send({
      message: "Server error",
      error: err.message
    });
  }
};