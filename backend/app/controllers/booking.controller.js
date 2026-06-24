const db = require("../models");
const mailService = require("../services/mail.service");
const Booking = db.booking;
const User = db.user;
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
      const product = await Product.findByPk(booking.product_id);

      if (product) {
        await product.update({
          quantity: product.quantity + 1
        });
      }
    }

    if (data.status === "No Show" && oldStatus !== "No Show") {
      const noShowCount = await Booking.count({
        where: {
          user_id: booking.user_id,
          status: "No Show"
        }
      });
      if (noShowCount >= 3) {
        await User.update(
          { account_status: "Banned" },
          { where: { user_id: booking.user_id } }
        );
      }
    }

    const statusesRequiringEmail = ["Accepted", "Rejected", "Cancelled", "Completed", "No Show"];
    if (statusesRequiringEmail.includes(data.status) && oldStatus !== data.status) {
      const bookingWithDetails = await Booking.findByPk(id, {
        include: [
          { model: User, as: "user" },
          { model: Product, as: "product" }
        ]
      });

      if (data.status === "Accepted") {
        mailService.sendBookingAcceptedEmail(bookingWithDetails)
          .catch(err => console.error("Accepted email error:", err));
      } else if (data.status === "Rejected") {
        mailService.sendBookingRejectedEmail(bookingWithDetails, data.rejection_reason)
          .catch(err => console.error("Reject email error:", err));
      } else if (data.status === "Cancelled") {
        mailService.sendBookingCancelEmail(bookingWithDetails)
          .catch(err => console.error("Cancel admin email error:", err));
      } else if (data.status === "Completed") {
        mailService.sendBookingCompletedEmail(bookingWithDetails)
          .catch(err => console.error("Completed email error:", err));
      } else if (data.status === "No Show") {
        mailService.sendBookingNoShowEmail(bookingWithDetails)
          .catch(err => console.error("No show email error:", err));
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