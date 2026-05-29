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

const formatDateWithDay = (dateInput) => {
  if (!dateInput) return "Unknown Date";
  const dateStr = typeof dateInput === "string" ? dateInput.split("T")[0] : dateInput.toISOString().split("T")[0];

  // Create date considering local time to avoid timezone shift
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${dateStr} (${dayName})`;
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

exports.sendVerificationEmail = async (email, token) => {
  const verifyLink = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "Verify your email address",
    html: `
      <p>Welcome to OG Vision AR!</p>
      <p>Please click <a href="${verifyLink}">here</a> to verify your email address and complete your registration.</p>
      <p>This link expires in 1 hour.</p>
    `,
  });
};

exports.sendNewBookingEmail = async (booking) => {
  const adminEmails = await getAdminEmails();

  const formattedDate = formatDateWithDay(booking.booking_date);
  const username = booking.user && booking.user.username ? booking.user.username : booking.user_id;
  const productInfo = booking.product && booking.product.brand ? `${booking.product.brand} - ${booking.product.model}` : booking.product_id;

  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: adminEmails,
    subject: "New Booking Received",
    html: `
        <h3>New Booking Notification</h3>
        <p>A new booking has been created.</p>
        <ul>
            <li><strong>Username:</strong> ${username}</li>
            <li><strong>Product:</strong> ${productInfo}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time Slot:</strong> ${booking.time_slot}</li>
            <li><strong>Status:</strong> ${booking.status}</li>
        </ul>
        <p>Please login to admin panel to review.</p>
        `,
  });
};

exports.sendBookingReminderEmail = async (booking) => {
  const adminEmails = await getAdminEmails();
  const formattedDate = formatDateWithDay(booking.booking_date);
  const username = booking.user && booking.user.username ? booking.user.username : booking.user_id;
  const productInfo = booking.product && booking.product.brand ? `${booking.product.brand} - ${booking.product.model}` : booking.product_id;

  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: adminEmails,
    subject: "Booking Reminder",
    html: `
        <p>There is a booking reminder for tomorrow still in pending.</p>
        <ul>
            <li><strong>Username:</strong> ${username}</li>
            <li><strong>Product:</strong> ${productInfo}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time Slot:</strong> ${booking.time_slot}</li>
        </ul>
        <p>Please login to admin panel to review.</p>
        `
  });
};

exports.sendBookingRejectedEmail = async (booking, reason) => {
  const formattedDate = formatDateWithDay(booking.booking_date);
  const productInfo = booking.product && booking.product.brand ? `${booking.product.brand} - ${booking.product.model}` : booking.product_id;
  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: booking.user.email,
    subject: "Booking Rejected",
    html: `
      <p>Your booking has been rejected.</p>
      <ul>
        <li><strong>Product:</strong> ${productInfo}</li>
        <li><strong>Date:</strong> ${formattedDate}</li>
        <li><strong>Time:</strong> ${booking.time_slot}</li>
        <li><strong>Reason:</strong> ${reason || "Not specified"}</li>
      </ul>
      <p>Please make a new booking.</p>
    `
  });
};

exports.sendBookingCancelEmail = async (booking) => {
  const adminEmails = await getAdminEmails();
  const formattedDate = formatDateWithDay(booking.booking_date);
  const username = booking.user && booking.user.username ? booking.user.username : booking.user_id;
  const productInfo = booking.product && booking.product.brand ? `${booking.product.brand} - ${booking.product.model}` : booking.product_id;

  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: adminEmails,
    subject: "Booking Cancelled",
    html: `
        <p>A customer has cancelled their booking.</p>
        <ul>
            <li><strong>Username:</strong> ${username}</li>
            <li><strong>Product:</strong> ${productInfo}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time Slot:</strong> ${booking.time_slot}</li>
        </ul>
        <p>Please login to admin panel to review.</p>
        `
  });
};

exports.sendBookingCompletedEmail = async (booking) => {
  const formattedDate = formatDateWithDay(booking.booking_date);
  const productInfo = booking.product && booking.product.brand ? `${booking.product.brand} - ${booking.product.model}` : booking.product_id;

  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: booking.user.email,
    subject: "Booking Completed - Thank You!",
    html: `
      <p>Your booking has been marked as completed. Thank you for visiting!</p>
      <ul>
        <li><strong>Product:</strong> ${productInfo}</li>
        <li><strong>Date:</strong> ${formattedDate}</li>
        <li><strong>Time:</strong> ${booking.time_slot}</li>
      </ul>
      <p>We hope to see you again soon.</p>
    `
  });
};

exports.sendBookingNoShowEmail = async (booking) => {
  const formattedDate = formatDateWithDay(booking.booking_date);
  const productInfo = booking.product && booking.product.brand ? `${booking.product.brand} - ${booking.product.model}` : booking.product_id;

  return transporter.sendMail({
    from: `"OG Vision" <${process.env.MAIL_USER}>`,
    to: booking.user.email,
    subject: "Missed Booking Notification",
    html: `
      <p>We noticed you missed your booking.</p>
      <ul>
        <li><strong>Product:</strong> ${productInfo}</li>
        <li><strong>Date:</strong> ${formattedDate}</li>
        <li><strong>Time:</strong> ${booking.time_slot}</li>
      </ul>
      <p>If you'd still like to try on our eyewear, please make a new booking through our system.</p>
    `
  });
};