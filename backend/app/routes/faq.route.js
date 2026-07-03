const { authJwt } = require("../middleware");

const faqRoutes = app => {
  const faqs = require("../controllers/faq.controller.js");
  const router = require("express").Router();

  // Retrieve all FAQs
  router.get("/", faqs.getAllFAQs);

  // Retrieve a single FAQ with id
  router.get("/:id", faqs.getFAQById);

  // Create a new FAQ (Admin only)
  router.post("/", [authJwt.verifyToken, authJwt.isAdmin], faqs.createFAQ);

  // Update a FAQ with id (Admin only)
  router.put("/:id", [authJwt.verifyToken, authJwt.isAdmin], faqs.updateFAQ);

  // Delete a FAQ with id (Admin only)
  router.delete("/:id", [authJwt.verifyToken, authJwt.isAdmin], faqs.deleteFAQ);

  app.use("/api/faqs", router);
};

module.exports = faqRoutes;