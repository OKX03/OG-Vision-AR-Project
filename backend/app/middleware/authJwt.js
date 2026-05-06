const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js"); 

verifyToken = (req, res, next) => {
  let token = req.headers["x-access-token"];

  if (!token) {
    return res.status(403).send({
      message: "No token provided!"
    });
  }

  jwt.verify(token,
            config.secret,
            (err, decoded) => {
              if (err) {
                return res.status(401).send({
                  message: "Unauthorized!",
                });
              }
              req.userId = decoded.id;
              req.userRole = decoded.role;
              console.log("Decoded token:", decoded);
              next();
            });
};

isAdmin = (req, res, next) => {
  if (req.userRole === "ROLE_ADMIN") {
    next();
  } else {
    res.status(403).send({
      message: "Require Admin Role!"
    });
  }
};

const authJwt = {
  verifyToken: verifyToken,
  isAdmin: isAdmin
};

module.exports = authJwt;