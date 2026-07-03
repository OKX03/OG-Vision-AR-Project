const { authJwt } = require("../middleware");
const multer = require("multer");
const products = require("../controllers/product.controller.js");
const router = require("express").Router();
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'og_vision_ar/images',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

// FIX: Added 'limits' to prevent massive file uploads (Security Issue)
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit in bytes
});

// FIX: Named the arrow function (Maintainability Issue)
const productRoutes = app => {
  router.get(
    "/",  
    [authJwt.verifyToken], 
    products.getAllProducts
  );

  router.get(
    "/:id", 
    [authJwt.verifyToken], 
    products.getProductById
  );  

  router.post(
    "/",
    upload.fields([
      { name: "front_image", maxCount: 1 },
      { name: "side_image", maxCount: 1 }
    ]),
    [authJwt.verifyToken, authJwt.isAdmin],
    products.createProduct
  );

  router.put(
    "/:id", 
    upload.fields([
      { name: "front_image", maxCount: 1 },
      { name: "side_image", maxCount: 1 }
    ]),
    [authJwt.verifyToken, authJwt.isAdmin],
    products.updateProduct
  );

  router.delete(
    "/:id", 
    [authJwt.verifyToken, authJwt.isAdmin], 
    products.deleteProduct
  );

  app.use("/api/products", router);
};

module.exports = productRoutes;