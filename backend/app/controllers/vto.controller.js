const db = require("../models");
const ARModel = db.ar_model;
const fs = require("fs");

exports.uploadModel= async (req, res) => {
  try {
    const product_id = req.params.product_id;

    if (!req.file) {
      return res.status(400).send({ message: "No file uploaded" });
    }

    let model = await ARModel.findOne({ where: { product_id } });

    const filePath = "/models/" + req.file.filename;

    if (model) {
      const oldPath = "public" + model.file_path;
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      model.file_path = filePath;
      await model.save();

      return res.send({ message: "AR model updated", model });
    } else {
      model = await ARModel.create({ product_id, file_path: filePath });
      return res.send({ message: "AR model uploaded", model });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: "Server error", error: err });
  }
};

exports.deleteModel = async (req, res) => {
  try {
    const product_id = req.params.product_id;

    const model = await ARModel.findOne({ where: { product_id } });
    if (!model) return res.status(404).send({ message: "Model not found" });

    const filePath = "public" + model.file_path;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await model.destroy();

    return res.send({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: "Server error", error: err });
  }
};

exports.getModelByProductId = async (req, res) => {
  try {
    const product_id = req.params.product_id;
    const model = await ARModel.findOne({ where: { product_id } });
    if (!model) return res.status(404).send({ message: "Model not found" });

    res.send(model);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error", error: err });
  }
};

exports.saveCalibration = async (req, res) => {
  try {
    const product_id = req.params.product_id;
    const { pitch, yaw, roll, scale, yOffset, zOffset } = req.body;
    console.log("Received calibration data:", { pitch, yaw, roll, scale, yOffset, zOffset });

    const model = await ARModel.findOne({ where: { product_id } });
    if (!model) return res.status(404).send({ message: "Model not found" });

    model.pitch = pitch;
    model.yaw = yaw;
    model.roll = roll;
    model.scale = scale;
    model.y_offset = yOffset;
    model.z_offset = zOffset;

    await model.update({
      pitch,
      yaw,
      roll,
      scale,
      y_offset: yOffset,
      z_offset: zOffset
    });

    res.send({ message: "Calibration saved successfully", model });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error", error: err });
  }
};
