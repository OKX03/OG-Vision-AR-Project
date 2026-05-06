const { authJwt } = require("../middleware");


module.exports = function(app) {
  const router = require("express").Router();
  const user = require("../controllers/user.controller");
  
  router.post(
    "/register", 
    user.register
  );

  router.post(
    "/login", 
    user.login
  );

  router.post(
    "/logout", 
    user.logout
  );

  router.post(
    "/recover-password", 
    user.recoverPassword
  );

  router.post(
    "/reset-password", 
    user.resetPassword
  );

  router.get(
    "/profile",
    [authJwt.verifyToken],
    user.getProfile
  );

  router.put(
    "/profile",
    [authJwt.verifyToken],
    user.updateProfile
  );

  router.get(
    "/status",
    [authJwt.verifyToken],
    user.getUserStatus
  );

  app.use("/api/users", router);
};