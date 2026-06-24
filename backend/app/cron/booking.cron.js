const cron = require("node-cron");
const { Op } = require("sequelize");
const db = require("../models");
const User = db.user;
const Booking = db.booking;
const Product = db.product;
const mailService = require("../services/mail.service");

const sendRemindersForDate = async (dateStr) => {
  try {
    console.log("dateSTR is: ", dateStr); 
    const bookings = await Booking.findAll({
      where: {
        booking_date: dateStr,
        status: "Pending"
      },
      include: [
        { model: User, as: "user" },
        { model: db.product, as: "product" }
      ]
    });

    for (const booking of bookings) {
      try {
        await mailService.sendBookingReminderEmail(booking);
      } catch (err) {
        console.error("Reminder email error:", err);
      }
    }
    console.log(`Reminder sent for ${bookings.length} bookings on ${dateStr}`);
  } catch (err) {
    console.error("Reminder cron error:", err);
  }
};

const autoRejectForDate = async (dateStr) => {
  try {
    const bookings = await Booking.findAll({
      where: {
        booking_date: dateStr,
        status: "Pending"
      },
      include: [
        { model: User, as: "user" },
        { model: db.product, as: "product" }
      ]
    });

    for (const booking of bookings) {
      booking.status = "Rejected";
      booking.rejection_reason = "No action by admin taken. Auto rejected.";
      await booking.save();

      // Restore product stock quantity
      if (booking.product_id) {
        const product = await Product.findByPk(booking.product_id);

        if (product) {
          await product.update({
            quantity: product.quantity + 1
          });
        }
      }

      try {
        await mailService.sendBookingRejectedEmail(booking, "No action by admin taken. Auto rejected.");
      } catch (err) {
        console.error("Reject email error:", err);
      }
    }
    console.log(`Auto rejected ${bookings.length} bookings on ${dateStr}`);
  } catch (err) {
    console.error("Auto reject cron error:", err);
  }
};

// Reminder Cron (Mon-Fri 18:00) - For tomorrow
const scheduleDailyReminders = () => {
  cron.schedule("0 18 * * 1-5", async () => {
    console.log("Running Reminder Cron (Mon-Fri 18:00)...");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    await sendRemindersForDate(dateStr);
  });
};

// Reminder Cron (Sat 17:00) - For Monday
const scheduleWeekendReminders = () => {
  cron.schedule("0 17 * * 6", async () => {
    console.log("Running Reminder Cron (Sat 17:00)...");
    const monday = new Date();
    monday.setDate(monday.getDate() + 2);
    const dateStr = monday.toISOString().split("T")[0];
    await sendRemindersForDate(dateStr);
  });
};

// Auto Reject Cron (Mon-Fri 19:00) - For tomorrow
const scheduleAutoRejectDaily = () => {
  cron.schedule("0 19 * * 1-5", async () => {
    console.log("Running Auto Reject Cron (Mon-Fri 19:00)...");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    await autoRejectForDate(dateStr);
  });
};

// Auto Reject Cron (Sat 18:00) - For Monday
const scheduleAutoRejectWeekend = () => {
  cron.schedule("0 18 * * 6", async () => {
    console.log("Running Auto Reject Cron (Sat 18:00)...");
    const monday = new Date();
    monday.setDate(monday.getDate() + 2);
    const dateStr = monday.toISOString().split("T")[0];
    await autoRejectForDate(dateStr);
  });
};

const scheduleAutoExpirationCheck = () => {
  cron.schedule("*/30 * * * *", async () => {
    console.log("Running Auto Expired Cron (every 30 minutes)...");

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
          const bookingDate = booking.booking_date;
          const [start, end] = booking.time_slot.split("-");
          const endTime = end.trim(); 

          const endDateTime = new Date(`${bookingDate} ${endTime}`);
          console.log("endDateTime is: ", endDateTime); 
          console.log("now is: ", now); 

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
};

// Initialize all cron jobs
const initCronJobs = () => {
  scheduleDailyReminders();
  scheduleWeekendReminders();
  scheduleAutoRejectDaily();
  scheduleAutoRejectWeekend();
  scheduleAutoExpirationCheck();
};

// Automatically start cron jobs when file is required (so we don't break existing setup)
initCronJobs();

module.exports = {
  sendRemindersForDate,
  autoRejectForDate,
  scheduleDailyReminders,
  scheduleWeekendReminders,
  scheduleAutoRejectDaily,
  scheduleAutoRejectWeekend,
  scheduleAutoExpirationCheck,
  initCronJobs
};