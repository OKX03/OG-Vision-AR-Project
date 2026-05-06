const nodemailer = require("nodemailer");
const User = require("../models").user;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const getAdminEmails = async () => {
  const admins = await User.findAll({
    where: { role: "ROLE_ADMIN" }
  });
    return admins.map(a => a.email);
};

exports.sendResetEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "Password Reset",
    html: `
      <p>You requested a password reset.</p>
      <p> Click <a href="${resetLink}">here</a> to reset your password.</p>
      <p>This link expires in 1 hour.</p>
    `,
  });
};

exports.sendNewBookingEmail = async (booking) => {
    const adminEmails = await getAdminEmails();

    return transporter.sendMail({
        from: `"OG Vision" <${process.env.MAIL_USER}>`,
        to: adminEmails,
        subject: "New Booking Received",
        html: `
        <h3>New Booking Notification</h3>
        <p>A new booking has been created.</p>
        <ul>
            <li><strong>User ID:</strong> ${booking.user_id}</li>
            <li><strong>Product ID:</strong> ${booking.product_id}</li>
            <li><strong>Date:</strong> ${booking.booking_date}</li>
            <li><strong>Time Slot:</strong> ${booking.time_slot}</li>
            <li><strong>Status:</strong> ${booking.status}</li>
        </ul>
        <p>Please login to admin panel to review.</p>
        `,
    });
};

exports.sendBookingReminderEmail = async (booking) => {
    const adminEmails = await getAdminEmails();

    return transporter.sendMail({
        from: `"OG Vision" <${process.env.MAIL_USER}>`,
        to: adminEmails,
        subject: "Booking Reminder",
        html: `
        <p>There is a booking reminder for tomorrow still in pending.</p>
        <ul>
            <li>Date: ${booking.booking_date}</li>
            <li>Time: ${booking.time_slot}</li>
        </ul>
        <p>Please login to admin panel to review.</p>
        `
    });
};

exports.sendBookingRejectedEmail = async (booking, reason) => {
  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: booking.user.email,
    subject: "Booking Rejected",
    html: `
      <p>Your booking has been rejected.</p>
      <ul>
        <li>Date: ${booking.booking_date}</li>
        <li>Time: ${booking.time_slot}</li>
        <li>Reason: ${reason || "Not specified"}</li>
      </ul>
      <p>Please make a new booking.</p>
    `
  });
};