const { authJwt } = require("../middleware");
const chatbotController = require("../controllers/chatbot.controller.js");

const chatbotRoutes = app => {
  const router = require("express").Router();

  // Create a new chat session
  router.post("/session", [authJwt.verifyToken], chatbotController.createSession);

  // Get chat history for a session
  router.get("/session/:session_id", [authJwt.verifyToken], chatbotController.getSessionHistory);

  // Send a message in a session
  router.post("/message", [authJwt.verifyToken], chatbotController.sendMessage);

  // End a chat session
  router.put("/session/:session_id/end", [authJwt.verifyToken], chatbotController.endSession);

  app.use("/api/chatbot", router);
};

module.exports = chatbotRoutes;
