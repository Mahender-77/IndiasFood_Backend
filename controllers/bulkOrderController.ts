import { Request, Response } from "express";
import { sendEmail } from "../utils/sendEmail";

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const submitBulkOrder = async (req: Request, res: Response) => {
  try {
    const {
      name,
      phone,
      email,
      eventType,
      deliveryDate,
      preferredProducts,
      message,
      company,
      quantity,
    } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, and message are required.",
      });
    }

    const safe = {
      name: escapeHtml(name),
      phone: escapeHtml(phone),
      email: escapeHtml(email),
      eventType: escapeHtml(eventType),
      deliveryDate: escapeHtml(deliveryDate),
      preferredProducts: escapeHtml(preferredProducts),
      message: escapeHtml(message),
      company: escapeHtml(company),
      quantity: escapeHtml(quantity),
    };

    await sendEmail({
      subject: "New Bulk Order Request",
      html: `
    <h2>New Bulk Order Request</h2>
    <p><strong>Name:</strong> ${safe.name}</p>
    <p><strong>Phone:</strong> ${safe.phone}</p>
    <p><strong>Email:</strong> ${safe.email}</p>
    <p><strong>Company:</strong> ${safe.company || "—"}</p>
    <p><strong>Event Type:</strong> ${safe.eventType || "—"}</p>
    <p><strong>Delivery Date:</strong> ${safe.deliveryDate || "—"}</p>
    <p><strong>Preferred Products:</strong> ${safe.preferredProducts || "—"}</p>
    <p><strong>Quantity:</strong> ${safe.quantity || "—"}</p>
    <p><strong>Message:</strong> ${safe.message}</p>
  `,
    });

    try {
      await sendEmail({
        to: String(email).trim(),
        subject: "We received your bulk order request",
        html: `<p>Thanks for your bulk order request. We will contact you soon.</p>`,
      });
    } catch (userEmailErr) {
      console.error("Bulk order user confirmation email failed:", userEmailErr);
    }

    return res.status(200).json({ success: true, message: "Bulk order request submitted." });
  } catch (err) {
    console.error("submitBulkOrder:", err);
    return res.status(500).json({
      success: false,
      message: "Could not submit your request. Please try again later.",
    });
  }
};
