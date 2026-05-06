module.exports = app => {
    const express = require("express");
    const router = express.Router();
    const bookings = require("../controllers/booking.controller");

    router.post("/", bookings.createBooking);

    router.get("/", bookings.getAllBookings);

    router.get("/:id", bookings.getBookingById);

    router.get("/user/:userId", bookings.getBookingsByUserId);

    router.put("/:id", bookings.updateBooking);

    router.delete("/:id", bookings.deleteBooking);

  app.use("/api/bookings", router);
};
