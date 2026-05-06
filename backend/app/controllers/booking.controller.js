const db = require("../models");
const mailService = require("../services/mail.service");
const Booking = db.booking;
const Product = db.product;

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

    mailService.sendNewBookingEmail(booking)
      .catch(err => console.error("Email error:", err));


    return res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      include: [
        { model: db.user, as: "user", attributes: ["user_id", "username", "email"] },
        { model: db.product, as: "product", attributes: ["product_id", "brand", "model"] }
      ],
      order: [["booking_date", "ASC"]]
    });
    return res.json(bookings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByPk(id, {
      include: [
        { model: db.user, as: "user", attributes: ["user_id", "name", "email"] },
        { model: db.product, as: "product", attributes: ["product_id", "brand", "model"] }
      ]
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getBookingsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Fetching bookings for user ID:", userId);
    const bookings = await Booking.findAll({
      where: { user_id: userId },
      include: [
        { model: db.product, as: "product", attributes: ["product_id", "brand", "model"] }
      ],
      order: [["booking_date", "ASC"]]
    });
    return res.json(bookings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const booking = await Booking.findByPk(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const oldStatus = booking.status;

    await booking.update(data);

    if (
      oldStatus === "Accepted" || oldStatus === "Pending" &&
      ["Rejected", "Cancelled", "No Show"].includes(data.status)
    ) {
      const product = await db.product.findByPk(booking.product_id);

      if (product) {
        await product.update({
          quantity: product.quantity + 1
        });
      }
    }

    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

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