const db = require("../models");
const config = require("../config/auth.config");
const mailService = require("../services/mail.service");
const User = db.user;
const Op = db.Sequelize.Op;

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const resetTokens = {};

exports.register = async (req, res) => {
  try {
    const userByUsername = await User.findOne({ where: { username: req.body.username } });
    if (userByUsername) return res.status(400).send({ message: "Username is already in use!" });

    const userByEmail = await User.findOne({ where: { email: req.body.email } });
    if (userByEmail) return res.status(400).send({ message: "Email is already in use!" });

    await User.create({
      username: req.body.username,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 8),
      gender: req.body.gender,
      role: req.body.role || "ROLE_CUSTOMER"
    });

    res.status(201).send({ message: "User was registered successfully!" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.login = (req, res) => {
  User.findOne({
    where: {
      [Op.or]: [
        { username: req.body.username },
        { email: req.body.username }
      ]
    }
  })
    .then(user => {
      if (!user) return res.status(404).send({ message: "User Not found." });

      const passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
      if (!passwordIsValid) {
        return res.status(401).send({ accessToken: null, message: "Invalid Password!" });
      }

      const token = jwt.sign(
        { id: user.user_id, role: user.role },
        config.secret,
        { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: config.jwtExpiration }
      );

      res.status(200).send({
        id: user.user_id,
        username: user.username,
        email: user.email,
        roles: user.role,
        accessToken: token
      });
    })
    .catch(err => res.status(500).send({ message: err.message }));
};

exports.logout = (req, res) => {
  res.status(200).send({ message: "You have been signed out!" });
};

exports.recoverPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(400).send({ message: "Email not registered" });

  const token = crypto.randomBytes(32).toString("hex");
  resetTokens[token] = { email, expires: Date.now() + 3600000 }; // 1 hour

  try {
    await mailService.sendResetEmail(email, token);
    res.status(200).send({ message: "Password reset email sent" });
  } catch (err) {
    res.status(500).send({ message: "Failed to send email" });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) return res.status(400).send({ message: "Missing parameters" });

  const storedToken = resetTokens[token];
  if (!storedToken || storedToken.email !== email || storedToken.expires < Date.now()) {
    return res.status(400).send({ message: "Invalid or expired token" });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(404).send({ message: "User not found" });

  user.password = bcrypt.hashSync(password, 8);
  await user.save();

  delete resetTokens[token];
  res.status(200).send({ message: "Password has been reset successfully" });
};

// --- PROFILE MANAGEMENT METHODS ---

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ["user_id", "username", "email", "gender", "role", "account_status"]
    });
    if (!user) return res.status(404).send({ message: "User not found" });
    res.send(user);
  } catch (err) {
    res.status(500).send({ message: err.message || "Error retrieving profile" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { username, gender } = req.body;
    const user = await User.findByPk(req.userId);

    if (!user) return res.status(404).send({ message: "User not found" });

    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) return res.status(400).send({ field: "username", message: "Username already taken" });
    }

    await User.update(
      { username: username || user.username, gender: gender || user.gender },
      { where: { user_id: req.userId } }
    );

    const updatedUser = await User.findByPk(req.userId, {
      attributes: ["user_id", "username", "email", "gender", "role"]
    });
    res.send(updatedUser);
  } catch (err) {
    res.status(500).send({ message: err.message || "Error updating profile" });
  }
};

exports.getUserStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, { attributes: ["account_status"] });
    if (!user) return res.status(404).send({ message: "User not found" });
    res.send({ status: user.account_status });
  } catch (err) {
    res.status(500).send({ message: err.message || "Error retrieving user status" });
  }
};