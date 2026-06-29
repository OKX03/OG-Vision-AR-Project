const db = require("../models");
const Product= db.product;
const ProductImage = db.product_image;
const ARModel = db.ar_model;
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const extractPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  const parts = url.split('/upload/');
  if (parts.length < 2) return null;
  let pathParts = parts[1].split('/');
  if (pathParts[0].startsWith('v')) {
    pathParts.shift();
  }
  const fullPath = pathParts.join('/');
  return fullPath.substring(0, fullPath.lastIndexOf('.')) || fullPath;
};

exports.getAllProducts = (req, res) => {

  Product.findAll({
    include: [
      {
        model: ProductImage,
        as: "images"
      },
      {
        model: ARModel,
        as: "ar_model"
      }
    ]
  })
  .then(data => {
    res.send(data);
  })
  .catch(err => {
    res.status(500).send({
      message:
        err.message || "Some error occurred while retrieving products."
    });
  });

};

exports.getProductById = (req, res) => {
  const id = req.params.id;

  Product.findByPk(id, {
    include: [
      {
        model: ProductImage,
        as: "images"
      },
      {
        model: ARModel,
        as: "ar_model"
      }
    ]
  })
    .then(data => {
      if (!data) {
        return res.status(404).send({
          message: `Cannot find Product with id=${id}.`
        });
      }
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message: "Error retrieving Product with id=" + id
      });
    });
};

exports.createProduct = async (req, res) => {
  try {
    console.log("Received product:", req.body);
    console.log("Received files:", req.files);

    const data = {
      brand: req.body.brand,
      model: req.body.model,
      price: req.body.price,
      gender: req.body.gender,
      color: req.body.color,
      frame_shape: req.body.frame_shape,
      frame_material: req.body.frame_material,
      face_shape: req.body.face_shape
          ? req.body.face_shape
          : null,
      frame_size: req.body.frame_size,
      lens_width: req.body.lens_width,
      lens_height: req.body.lens_height,
      bridge_width: req.body.bridge_width,
      temple_length: req.body.temple_length,
      description: req.body.description,
      quantity: req.body.quantity
    };

    const product = await Product.create(data);
    console.log("Inserted product:", product);

    const images = [];
    if (req.files?.front_image) {
      images.push({
        product_id: product.product_id,
        image_url: req.files.front_image[0].path,
        view_type: "front"
      });
    }
    if (req.files?.side_image) {
      images.push({
        product_id: product.product_id,
        image_url: req.files.side_image[0].path,
        view_type: "side"
      });
    }

    if (images.length > 0) {
      await ProductImage.bulkCreate(images);
    }

    const result = await Product.findByPk(product.product_id, {
      include: [
        {
          model: ProductImage,
          as: "images"
        }
      ]
    });

    res.send(result);
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).send({
      message: err.message || "Some error occurred while creating the Product."
    });
  }
};

exports.updateProduct = async (req, res) => {
  const id = req.params.id;

  console.log("BODY:", req.body);
  console.log("FILES:", req.files);
  
  try {
    const product = await Product.findByPk(id, {
      include: [{ model: ProductImage, as: 'images' }]
    });
    if (!product) return res.status(404).send({ message: 'Product not found' });

    const data = {
      brand: req.body.brand,
      model: req.body.model,
      price: req.body.price,
      gender: req.body.gender,
      color: req.body.color,
      frame_shape: req.body.frame_shape,
      frame_material: req.body.frame_material,
      face_shape: req.body.face_shape
          ? req.body.face_shape
          : null,
      frame_size: req.body.frame_size,
      lens_width: req.body.lens_width,
      lens_height: req.body.lens_height,
      bridge_width: req.body.bridge_width,
      temple_length: req.body.temple_length,
      description: req.body.description,
      quantity: req.body.quantity
    };

    await Product.update(data, { where: { product_id: id } });

    const viewTypeMap = {
      front_image: 'front',
      side_image: 'side'
    };

    if (req.files) {
      for (const key of Object.keys(req.files)) {

        const fileArray = req.files[key];
        if (!fileArray || fileArray.length === 0) continue;

        const file = fileArray[0];

        const viewType = viewTypeMap[key];
        if (!viewType) continue;

        let existingImage = await ProductImage.findOne({
          where: {
            product_id: id,
            view_type: viewType
          }
        });

        if (existingImage) {
          if (existingImage.image_url.includes('cloudinary.com')) {
            const publicId = extractPublicId(existingImage.image_url);
            if (publicId) {
              await cloudinary.uploader.destroy(publicId);
            }
          } else {
            const oldImagePath = path.resolve(
              __dirname,
              '..',
              '..',
              'public',
              existingImage.image_url.replace(/^\/+/, '')
            );
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          }

          await ProductImage.update(
            { image_url: file.path },
            { where: { image_id: existingImage.image_id } }
          );

        } else {
          await ProductImage.create({
            product_id: id,
            image_url: file.path,
            view_type: viewType
          });
        }
      }
    }

    const updatedProduct = await Product.findByPk(id, {
      include: [{ model: ProductImage, as: 'images' }]
    });

    res.send(updatedProduct);

  } catch (err) {
    console.error(err);
    res.status(500).send({ message: err.message || 'Error updating product' });
  }
};

exports.deleteProduct = async (req, res) => {
  const id = req.params.id;

  try {
    const product = await Product.findByPk(id, { include: [{ model: ProductImage, as: 'images' }] });

    if (!product) return res.status(404).send({ message: `Product with id=${id} not found!` });

    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        if (img.image_url.includes('cloudinary.com')) {
          const publicId = extractPublicId(img.image_url);
          if (publicId) await cloudinary.uploader.destroy(publicId);
        } else {
          const imagePath = path.resolve(__dirname, '..', '..', 'public', img.image_url.replace(/^\/+/, ''));
          if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }
        await ProductImage.destroy({ where: { image_id: img.image_id } });
      }
    }
    
    const model = await ARModel.findOne({ where: { product_id: id } });

    if (model) {
      const filePath = "public" + model.file_path;

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await model.destroy();
    }

    await Product.destroy({ where: { product_id: id } });

    res.send({ message: 'Product was deleted successfully!' });

  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).send({ message: `Could not delete Product with id=${id}` });
  }
};