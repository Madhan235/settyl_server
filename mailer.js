import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "msouljar@gmail.com",
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Function to send email
// Function to send email
export const sendLikeNotificationEmail = async (
  postOwnerEmail,
  likedByUsername,
  postTitle,
  action
) => {
  let event = "";
  let subject = "";

  if (action === "Liked") {
    event = `liked your post titled "${postTitle}"`;
    subject = `${likedByUsername} liked your post!`;
  } else if (action === "Commented") {
    event = `commented on your post titled "${postTitle}"`;
    subject = `${likedByUsername} commented on your post!`;
  } else if (action === "Following You") {
    event = "started following you";
    subject = `${likedByUsername} is now following you!`;
  }

  const mailOptions = {
    from: process.env.EMAIL,
    to: postOwnerEmail,
    subject: subject,
    text: `Hey, ${likedByUsername} ${event}.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Notification email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error.message);
  }
};
