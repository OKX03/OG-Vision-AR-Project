const db = require("../models");
const ARModel = db.ar_model;

const fs = require("fs");
const path = require("path");

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

    const filePath = "/models/" + req.file.filename;

    if (model) {

      const oldPath = path.resolve(
        __dirname,
        "..",
        "..",
        "public",
        model.file_path.replace(/^\/+/, "")
      );

      await model.update({
        file_path: filePath
      });

      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          console.log("Old model deleted");
        } catch (fsErr) {
          console.warn(
            "Could not delete old model:",
            fsErr.message
          );
        }
      }

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

    const filePath = path.resolve(
      __dirname,
      "..",
      "..",
      "public",
      model.file_path.replace(/^\/+/, "")
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

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