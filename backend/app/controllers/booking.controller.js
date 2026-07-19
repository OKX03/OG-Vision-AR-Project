const db = require("../models");
const mailService = require("../services/mail.service");
const Booking = db.booking;
const User = db.user;
const Product = db.product;

// FIX: Helper function to handle inventory updates based on booking status changes (Maintainability Issue)
// Helper function to handle inventory updates based on booking status changes.
const handleInventoryUpdate = async (product_id, oldStatus, newStatus) => {
  if ((oldStatus === "Accepted" || oldStatus === "Pending") && ["Rejected", "Cancelled", "No Show"].includes(newStatus)) {
    const product = await Product.findByPk(product_id);
    if (product) {
      await product.update({ quantity: product.quantity + 1 });
    }
  }
};

// Helper function to handle automatic user bans for repeated no-shows.
const handleNoShowBans = async (user_id, oldStatus, newStatus) => {
  if (newStatus === "No Show" && oldStatus !== "No Show") {
    const noShowCount = await Booking.count({ where: { user_id, status: "No Show" } });
    if (noShowCount >= 3) {
      await User.update({ account_status: "Banned" }, { where: { user_id } });
    }
  }
};

// Helper function to trigger email notifications based on booking status changes.
const handleBookingEmails = async (bookingId, oldStatus, newStatus, rejectionReason) => {
  const statusesRequiringEmail = ["Accepted", "Rejected", "Cancelled", "Completed", "No Show"];
  
  if (statusesRequiringEmail.includes(newStatus) && oldStatus !== newStatus) {
    const bookingWithDetails = await Booking.findByPk(bookingId, {
      include: [{ model: User, as: "user" }, { model: Product, as: "product" }]
    });

    try {
      if (newStatus === "Accepted") await mailService.sendBookingAcceptedEmail(bookingWithDetails);
      else if (newStatus === "Rejected") await mailService.sendBookingRejectedEmail(bookingWithDetails, rejectionReason);
      else if (newStatus === "Cancelled") await mailService.sendBookingCancelEmail(bookingWithDetails);
      else if (newStatus === "Completed") await mailService.sendBookingCompletedEmail(bookingWithDetails);
      else if (newStatus === "No Show") await mailService.sendBookingNoShowEmail(bookingWithDetails);
    } catch (err) {
      console.error(`${newStatus} email error:`, err);
    }
  }
};

// Controller action to create and save a new booking.
exports.createBooking = async (req, res) => {
  try {
    const { user_id, product_id, booking_date, time_slot } = req.body;

    const booking = await Booking.create({
      user_id,
      product_id,
      booking_date,
      time_slot,
      status: "Pending"
    });

    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await product.update({ quantity: Math.max(product.quantity - 1, 0) });

    const bookingWithDetails = await Booking.findByPk(booking.booking_id, {
      include: [
        { model: User, as: "user" },
        { model: Product, as: "product" }
      ]
    });

    mailService.sendNewBookingEmail(bookingWithDetails)
      .catch(err => console.error("Email error:", err));


    return res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Controller action to retrieve all bookings from the database.
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      include: [
        { model: User, as: "user", attributes: ["user_id", "username", "email", "phone_number"] },
        { model: Product, as: "product", attributes: ["product_id", "brand", "model", "quantity"] }
      ],
      order: [["booking_date", "ASC"]]
    });
    return res.json(bookings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Controller action to find a single booking by its ID.
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByPk(id, {
      include: [
        { model: User, as: "user", attributes: ["user_id", "name", "email"] },
        { model: Product, as: "product", attributes: ["product_id", "brand", "model", "quantity"] }
      ]
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Controller action to retrieve all bookings associated with a specific user.
exports.getBookingsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Fetching bookings for user ID:", userId);
    const bookings = await Booking.findAll({
      where: { user_id: userId },
      include: [
        { model: Product, as: "product", attributes: ["product_id", "brand", "model", "quantity"] }
      ],
      order: [["booking_date", "ASC"]]
    });
    return res.json(bookings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Controller action to update a booking's status.
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const booking = await Booking.findByPk(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const oldStatus = booking.status;
    await booking.update(data);

    await handleInventoryUpdate(booking.product_id, oldStatus, data.status);
    await handleNoShowBans(booking.user_id, oldStatus, data.status);
    await handleBookingEmails(id, oldStatus, data.status, data.rejection_reason);

    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Controller action to delete a booking by its ID.
exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByPk(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    await booking.destroy();
    return res.json({ message: "Booking deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};