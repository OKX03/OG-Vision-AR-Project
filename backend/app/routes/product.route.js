const { authJwt } = require("../middleware");

module.exports = app => {
  const multer = require("multer");
  const path = require("path");
  const products = require("../controllers/product.controller.js");
  const router = require("express").Router();

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/images');
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + file.fieldname;
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ storage: storage });

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
