const cron = require("node-cron");
const { Op } = require("sequelize");
const User = require("../models").user;
const mailService = require("../services/mail.service");

const Booking = db.booking;

cron.schedule("0 17 * * *", async () => {
  console.log("Running Reminder Cron (17:00)...");

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateStr = tomorrow.toISOString().split("T")[0];

    const bookings = await Booking.findAll({
      where: {
        booking_date: {
          [Op.like]: `${dateStr}%`
        },
        status: "Pending"
      },
      include: [{ model: User, as: "user" }]
    });

    for (const booking of bookings) {
      try {
        await mailService.sendBookingReminderEmail(booking);
      } catch (err) {
        console.error("Reminder email error:", err);
      }
    }

    console.log(`Reminder sent for ${bookings.length} bookings`);
  } catch (err) {
    console.error("Reminder cron error:", err);
  }
});

cron.schedule("0 8 * * *", async () => {
  console.log("Running Auto Reject Cron (08:00)...");

  try {
    const today = new Date().toISOString().split("T")[0];

    const bookings = await Booking.findAll({
      where: {
        booking_date: {
          [Op.like]: `${today}%`
        },
        status: "Pending"
      },
      include: [{ model: db.user, as: "user" }]
    });

    for (const booking of bookings) {
      booking.status = "Rejected";
      await booking.save();

      try {
        await mailService.sendBookingRejectedEmail(booking, "No action by admin taken. Auto rejected.");
      } catch (err) {
        console.error("Reject email error:", err);
      }
    }

    console.log(`Auto rejected ${bookings.length} bookings`);
  } catch (err) {
    console.error("Auto reject cron error:", err);
  }
});

cron.schedule("0 * * * *", async () => {
  console.log("Running Auto Expired Cron (every hour)...");

  try {
    const now = new Date();

    const bookings = await Booking.findAll({
      where: {
        status: "Accepted"
      }
    });

    let expiredCount = 0;

    for (const booking of bookings) {
      try {
        const bookingDate = booking.booking_date.toISOString().split("T")[0];

        const [start, end] = booking.time_slot.split("-");
        const endTime = end.trim(); 

        const endDateTime = new Date(`${bookingDate} ${endTime}`);

        if (now >= endDateTime) {
          booking.status = "Expired";
          await booking.save();
          expiredCount++;
        }

      } catch (err) {
        console.error("Error processing booking:", booking.booking_id, err);
      }
    }

    console.log(`Auto expired ${expiredCount} bookings`);

  } catch (err) {
    console.error("Auto expired cron error:", err);
  }
});