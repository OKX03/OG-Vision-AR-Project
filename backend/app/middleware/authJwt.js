const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js"); 

// FIX: Added const to explicitly declare the function variable (Maintainability Issue)
// Middleware function to verify a JSON Web Token (JWT) provided in the request headers.
const verifyToken = (req, res, next) => {
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

// FIX: Added const to explicitly declare the function variable (Maintainability Issue)
// Middleware function to verify if the authenticated user has an Administrator role.
const isAdmin = (req, res, next) => {
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