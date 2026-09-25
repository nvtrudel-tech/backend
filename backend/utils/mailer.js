const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// While using Resend's test/free tier without a verified custom domain,
// you must send FROM this address (or a verified domain you've set up in Resend).
const FROM_ADDRESS = "Connexions <onboarding@resend.dev>";

async function sendBookingConfirmationEmails(appointment) {
  const customerEmail = appointment.customer?.email;
  const workerEmail = appointment.worker?.email;
  const customerName = appointment.customer?.name || "Customer";
  const workerName = appointment.worker?.name || "Specialist";
  const service = appointment.service;

  const formattedDate = new Date(appointment.date).toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const price = appointment.totalPrice ? `$${appointment.totalPrice.toFixed(2)}` : "N/A";
  const address = appointment.address || "";

  const detailsHtml = `
    <p><strong>Service:</strong> ${service}</p>
    <p><strong>Date &amp; Time:</strong> ${formattedDate}</p>
    <p><strong>Address:</strong> ${address}</p>
    <p><strong>Price:</strong> ${price}</p>
  `;

  const sendPromises = [];

  if (customerEmail) {
    sendPromises.push(
      resend.emails.send({
        from: FROM_ADDRESS,
        to: customerEmail,
        subject: `Booking Confirmed: ${service}`,
        html: `
          <h2>Your appointment is confirmed!</h2>
          <p>Hi ${customerName},</p>
          <p>Your ${service} appointment with ${workerName} has been confirmed.</p>
          ${detailsHtml}
          <p>Thanks for using Connexions!</p>
        `,
      })
    );
  } else {
    console.log(`No customer email found for appointment ${appointment._id}`);
  }

  if (workerEmail) {
    sendPromises.push(
      resend.emails.send({
        from: FROM_ADDRESS,
        to: workerEmail,
        subject: `Job Confirmed: ${service}`,
        html: `
          <h2>Job confirmed!</h2>
          <p>Hi ${workerName},</p>
          <p>${customerName} has accepted your price for the ${service} job.</p>
          ${detailsHtml}
          <p>Thanks for using Connexions!</p>
        `,
      })
    );
  } else {
    console.log(`No worker email found for appointment ${appointment._id}`);
  }

  const results = await Promise.allSettled(sendPromises);
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Booking confirmation email ${i} failed:`, result.reason);
    } else if (result.value?.error) {
      console.error(`Booking confirmation email ${i} returned an error:`, result.value.error);
    }
  });

  console.log(`📧 Booking confirmation emails processed for appointment ${appointment._id}`);
}

module.exports = { sendBookingConfirmationEmails };
