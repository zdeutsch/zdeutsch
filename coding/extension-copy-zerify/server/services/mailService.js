const os = require("os");
const tls = require("tls");
const { execFile } = require("child_process");

function unique(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function getMailConfig() {
  const host = String(process.env.SMTP_HOST || "smtp.gmail.com").trim() || "smtp.gmail.com";
  const port = Number.parseInt(process.env.SMTP_PORT || "465", 10);
  const senderEmail = String(process.env.EMAIL_USER || "").trim();
  const senderName = String(process.env.NAME_USER || "ZDeutsch").trim() || "ZDeutsch";
  const rawPassword = String(process.env.EMAIL_PASS || "").trim();
  const contactPhone = String(process.env.CONTACT_PHONE || "").trim();

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    senderEmail,
    senderName,
    passwordVariants: unique([
      rawPassword,
      rawPassword.replace(/\s+/g, "")
    ]),
    contactPhone
  };
}

function wrapBase64(value) {
  const chunks = String(value || "").match(/.{1,76}/g);
  return chunks ? chunks.join("\r\n") : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toWhatsAppUrl(phone) {
  const digits = String(phone || "").replace(/\D+/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function createMessage({ to, subject, textBody, htmlBody, fromName, fromEmail }) {
  const messageId = `<${Date.now()}.${Math.random().toString(16).slice(2)}@zdeutsch.local>`;
  const boundary = `zdeutsch-alt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const encodedTextBody = wrapBase64(Buffer.from(String(textBody || ""), "utf8").toString("base64"));
  const encodedHtmlBody = wrapBase64(Buffer.from(String(htmlBody || ""), "utf8").toString("base64"));

  return [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedTextBody,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedHtmlBody,
    "",
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

function createSmtpSession(socket) {
  let buffer = "";
  let currentLines = [];
  const queuedResponses = [];
  const pendingWaiters = [];

  function resolveResponse(text) {
    if (pendingWaiters.length) {
      pendingWaiters.shift().resolve(text);
      return;
    }
    queuedResponses.push(text);
  }

  function rejectAll(error) {
    while (pendingWaiters.length) {
      pendingWaiters.shift().reject(error);
    }
  }

  function handleLine(line) {
    if (!line) {
      return;
    }

    currentLines.push(line);
    if (/^\d{3} /.test(line)) {
      resolveResponse(currentLines.join("\n"));
      currentLines = [];
    }
  }

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      handleLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  });

  socket.on("error", (error) => {
    rejectAll(error);
  });

  socket.on("close", () => {
    rejectAll(new Error("SMTP connection closed unexpectedly"));
  });

  return {
    waitForResponse() {
      if (queuedResponses.length) {
        return Promise.resolve(queuedResponses.shift());
      }
      return new Promise((resolve, reject) => {
        pendingWaiters.push({ resolve, reject });
      });
    },
    sendLine(line) {
      socket.write(`${line}\r\n`);
    },
    sendData(data) {
      socket.write(data);
    }
  };
}

async function expectResponse(session, expectedCodes) {
  const response = await session.waitForResponse();
  const allowed = Array.isArray(expectedCodes) ? expectedCodes.map(String) : [String(expectedCodes)];
  const code = response.slice(0, 3);

  if (!allowed.includes(code)) {
    throw new Error(`SMTP error: ${response}`);
  }

  return response;
}

async function tryPasswordVariants(passwordVariants, attempt) {
  const variants = unique(passwordVariants);
  if (!variants.length) {
    throw new Error("No password variants available");
  }

  let lastError = null;
  for (const password of variants) {
    try {
      return await attempt(password);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("SMTP authentication failed");
}

function buildAcceptedContributionTextBody({ themeTitle, partLabel, senderName, senderEmail, contactPhone }) {
  const safeTheme = String(themeTitle || "ZDeutsch");
  const safePart = String(partLabel || "Lesen");

  return [
    "السلام عليكم،",
    "",
    "شكراً جزيلاً لك على مساهمتك القيّمة في مجتمع ZDeutsch.",
    "تم قبول التصحيح الذي أرسلته بنجاح، ونقدّر كثيراً وقتك وحرصك على مساعدة المتعلمين الآخرين.",
    `الموضوع: ${safeTheme}`,
    `القسم: ${safePart}`,
    "",
    "مساهماتك تساعدنا على تحسين دقة المحتوى وجودته، وتجعل ZDeutsch أفضل للجميع.",
    "",
    "إذا كانت لديك ملاحظات إضافية أو أردت التواصل معي مباشرة، يمكنك ذلك عبر:",
    `${senderName}`,
    `البريد الإلكتروني: ${senderEmail}`,
    `الهاتف / واتساب: ${contactPhone}`,
    "",
    "مع خالص الشكر والتقدير،",
    `${senderName}`,
    "",
    "----------------------------------------",
    "",
    "Hello,",
    "",
    "Thank you very much for your valuable contribution to the ZDeutsch community.",
    "Your correction has been accepted successfully, and I truly appreciate the time and care you took to help other learners.",
    `Theme: ${safeTheme}`,
    `Part: ${safePart}`,
    "",
    "Contributions like yours help us keep ZDeutsch accurate, useful, and better for everyone.",
    "",
    "If you would like to share more feedback or contact me directly, please feel free to reach me at:",
    `${senderName}`,
    `Email: ${senderEmail}`,
    `Phone / WhatsApp: ${contactPhone}`,
    "",
    "With sincere thanks,",
    `${senderName}`,
    ""
  ].join("\n");
}

function buildAcceptedContributionHtmlBody({ themeTitle, partLabel, senderName, senderEmail, contactPhone }) {
  const safeTheme = escapeHtml(themeTitle || "ZDeutsch");
  const safePart = escapeHtml(partLabel || "Lesen");
  const safeSenderName = escapeHtml(senderName || "ZDeutsch");
  const safeSenderEmail = escapeHtml(senderEmail || "");
  const safeContactPhone = escapeHtml(contactPhone || "");
  const whatsappUrl = toWhatsAppUrl(contactPhone);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <body style=\"margin:0;padding:24px;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">",
    "    <div style=\"max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;\">",
    "      <div style=\"padding:28px 32px 20px;border-bottom:1px solid #e5e7eb;background:linear-gradient(135deg,#f8fafc,#eef4ff);\">",
    "        <h1 style=\"margin:0;font-size:28px;line-height:1.25;color:#111827;\">Thank you for your contribution to ZDeutsch</h1>",
    "      </div>",
    "      <div style=\"padding:28px 32px 8px;\">",
    "        <section dir=\"rtl\" lang=\"ar\" style=\"direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#111827;\">",
    "          <p style=\"margin:0 0 18px;\">السلام عليكم،</p>",
    "          <p style=\"margin:0 0 12px;\">شكراً جزيلاً لك على مساهمتك القيّمة في مجتمع ZDeutsch.</p>",
    "          <p style=\"margin:0 0 12px;\">تم قبول التصحيح الذي أرسلته بنجاح، ونقدّر كثيراً وقتك وحرصك على مساعدة المتعلمين الآخرين.</p>",
    `          <p style="margin:0 0 8px;"><strong>الموضوع:</strong> <span dir="ltr">${safeTheme}</span></p>`,
    `          <p style="margin:0 0 18px;"><strong>القسم:</strong> <span dir="ltr">${safePart}</span></p>`,
    "          <p style=\"margin:0 0 12px;\">مساهماتك تساعدنا على تحسين دقة المحتوى وجودته، وتجعل ZDeutsch أفضل للجميع.</p>",
    "          <p style=\"margin:0 0 12px;\">إذا كانت لديك ملاحظات إضافية أو أردت التواصل معي مباشرة، يمكنك ذلك عبر:</p>",
    `          <p style="margin:0 0 4px;"><strong>${safeSenderName}</strong></p>`,
    `          <p style="margin:0 0 4px;"><strong>البريد الإلكتروني:</strong> <a href="mailto:${safeSenderEmail}" dir="ltr" style="color:#2563eb;text-decoration:none;">${safeSenderEmail}</a></p>`,
    `          <p style="margin:0 0 18px;"><strong>الهاتف / واتساب:</strong> ${whatsappUrl ? `<a href="${escapeHtml(whatsappUrl)}" dir="ltr" style="color:#2563eb;text-decoration:none;">${safeContactPhone}</a>` : `<span dir="ltr">${safeContactPhone}</span>`}</p>`,
    "          <p style=\"margin:0 0 0;\">مع خالص الشكر والتقدير،</p>",
    `          <p style="margin:6px 0 0;"><strong>${safeSenderName}</strong></p>`,
    "        </section>",
    "        <hr style=\"border:none;border-top:1px solid #e5e7eb;margin:28px 0;\">",
    "        <section dir=\"ltr\" lang=\"en\" style=\"text-align:left;line-height:1.8;color:#111827;\">",
    "          <p style=\"margin:0 0 18px;\">Hello,</p>",
    "          <p style=\"margin:0 0 12px;\">Thank you very much for your valuable contribution to the ZDeutsch community.</p>",
    "          <p style=\"margin:0 0 12px;\">Your correction has been accepted successfully, and I truly appreciate the time and care you took to help other learners.</p>",
    `          <p style="margin:0 0 8px;"><strong>Theme:</strong> ${safeTheme}</p>`,
    `          <p style="margin:0 0 18px;"><strong>Part:</strong> ${safePart}</p>`,
    "          <p style=\"margin:0 0 12px;\">Contributions like yours help us keep ZDeutsch accurate, useful, and better for everyone.</p>",
    "          <p style=\"margin:0 0 12px;\">If you would like to share more feedback or contact me directly, please feel free to reach me at:</p>",
    `          <p style="margin:0 0 4px;"><strong>${safeSenderName}</strong></p>`,
    `          <p style="margin:0 0 4px;"><strong>Email:</strong> <a href="mailto:${safeSenderEmail}" style="color:#2563eb;text-decoration:none;">${safeSenderEmail}</a></p>`,
    `          <p style="margin:0 0 18px;"><strong>Phone / WhatsApp:</strong> ${whatsappUrl ? `<a href="${escapeHtml(whatsappUrl)}" style="color:#2563eb;text-decoration:none;">${safeContactPhone}</a>` : safeContactPhone}</p>`,
    "          <p style=\"margin:0 0 0;\">With sincere thanks,</p>",
    `          <p style="margin:6px 0 0;"><strong>${safeSenderName}</strong></p>`,
    "        </section>",
    "      </div>",
    "    </div>",
    "  </body>",
    "</html>"
  ].join("\n");
}

function buildRejectedContributionTextBody({ themeTitle, partLabel, senderName, senderEmail, contactPhone }) {
  const safeTheme = String(themeTitle || "ZDeutsch");
  const safePart = String(partLabel || "Lesen");
  const whatsappUrl = toWhatsAppUrl(contactPhone);

  return [
    "السلام عليكم،",
    "",
    "شكراً لك على مساهمتك في مجتمع ZDeutsch وعلى الوقت الذي خصصته لإرسال التصحيح.",
    "بعد مراجعة إجابتك مع مجتمع ZDeutsch، قررنا في الوقت الحالي عدم اعتماد هذا التصحيح.",
    `الموضوع: ${safeTheme}`,
    `القسم: ${safePart}`,
    "",
    "إذا كنت ترى أن إجابتك صحيحة، يمكنك إعادة إرسالها مرة أخرى مع توضيح أقوى، أو التواصل معنا عبر واتساب لإقناعنا ومناقشة السبب.",
    "",
    `${senderName}`,
    `البريد الإلكتروني: ${senderEmail}`,
    `الهاتف / واتساب: ${contactPhone}`,
    ...(whatsappUrl ? [`رابط واتساب: ${whatsappUrl}`] : []),
    "",
    "نقدّر مساهمتك ونرحب دائماً بمحاولاتك الجديدة.",
    "",
    "مع خالص الشكر والتقدير،",
    `${senderName}`,
    "",
    "----------------------------------------",
    "",
    "Hello,",
    "",
    "Thank you for your contribution to the ZDeutsch community and for taking the time to submit your correction.",
    "After reviewing your submission with the ZDeutsch community, we decided not to accept this answer at the moment.",
    `Theme: ${safeTheme}`,
    `Part: ${safePart}`,
    "",
    "If you believe your answer is correct, you are welcome to submit it again with a stronger explanation, or contact us on WhatsApp and convince us there.",
    "",
    `${senderName}`,
    `Email: ${senderEmail}`,
    `Phone / WhatsApp: ${contactPhone}`,
    ...(whatsappUrl ? [`WhatsApp: ${whatsappUrl}`] : []),
    "",
    "We appreciate your contribution and will be glad to review a new submission from you.",
    "",
    "With sincere thanks,",
    `${senderName}`,
    ""
  ].join("\n");
}

function buildRejectedContributionHtmlBody({ themeTitle, partLabel, senderName, senderEmail, contactPhone }) {
  const safeTheme = escapeHtml(themeTitle || "ZDeutsch");
  const safePart = escapeHtml(partLabel || "Lesen");
  const safeSenderName = escapeHtml(senderName || "ZDeutsch");
  const safeSenderEmail = escapeHtml(senderEmail || "");
  const safeContactPhone = escapeHtml(contactPhone || "");
  const whatsappUrl = toWhatsAppUrl(contactPhone);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <body style=\"margin:0;padding:24px;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">",
    "    <div style=\"max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;\">",
    "      <div style=\"padding:28px 32px 20px;border-bottom:1px solid #e5e7eb;background:linear-gradient(135deg,#f8fafc,#fff4f4);\">",
    "        <h1 style=\"margin:0;font-size:28px;line-height:1.25;color:#111827;\">Update on your contribution to ZDeutsch</h1>",
    "      </div>",
    "      <div style=\"padding:28px 32px 8px;\">",
    "        <section dir=\"rtl\" lang=\"ar\" style=\"direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#111827;\">",
    "          <p style=\"margin:0 0 18px;\">السلام عليكم،</p>",
    "          <p style=\"margin:0 0 12px;\">شكراً لك على مساهمتك في مجتمع ZDeutsch وعلى الوقت الذي خصصته لإرسال التصحيح.</p>",
    "          <p style=\"margin:0 0 12px;\">بعد مراجعة إجابتك مع مجتمع ZDeutsch، قررنا في الوقت الحالي عدم اعتماد هذا التصحيح.</p>",
    `          <p style="margin:0 0 8px;"><strong>الموضوع:</strong> <span dir="ltr">${safeTheme}</span></p>`,
    `          <p style="margin:0 0 18px;"><strong>القسم:</strong> <span dir="ltr">${safePart}</span></p>`,
    "          <p style=\"margin:0 0 12px;\">إذا كنت ترى أن إجابتك صحيحة، يمكنك إعادة إرسالها مرة أخرى مع توضيح أقوى، أو التواصل معنا عبر واتساب لإقناعنا ومناقشة السبب.</p>",
    `          <p style="margin:0 0 4px;"><strong>${safeSenderName}</strong></p>`,
    `          <p style="margin:0 0 4px;"><strong>البريد الإلكتروني:</strong> <a href="mailto:${safeSenderEmail}" dir="ltr" style="color:#2563eb;text-decoration:none;">${safeSenderEmail}</a></p>`,
    `          <p style="margin:0 0 4px;"><strong>الهاتف / واتساب:</strong> ${whatsappUrl ? `<a href="${escapeHtml(whatsappUrl)}" dir="ltr" style="color:#2563eb;text-decoration:none;">${safeContactPhone}</a>` : `<span dir="ltr">${safeContactPhone}</span>`}</p>`,
    `          ${whatsappUrl ? `<p style="margin:0 0 18px;"><strong>رابط واتساب:</strong> <a href="${escapeHtml(whatsappUrl)}" dir="ltr" style="color:#2563eb;text-decoration:none;">${escapeHtml(whatsappUrl)}</a></p>` : ""}`,
    "          <p style=\"margin:0 0 12px;\">نقدّر مساهمتك ونرحب دائماً بمحاولاتك الجديدة.</p>",
    "          <p style=\"margin:0 0 0;\">مع خالص الشكر والتقدير،</p>",
    `          <p style="margin:6px 0 0;"><strong>${safeSenderName}</strong></p>`,
    "        </section>",
    "        <hr style=\"border:none;border-top:1px solid #e5e7eb;margin:28px 0;\">",
    "        <section dir=\"ltr\" lang=\"en\" style=\"text-align:left;line-height:1.8;color:#111827;\">",
    "          <p style=\"margin:0 0 18px;\">Hello,</p>",
    "          <p style=\"margin:0 0 12px;\">Thank you for your contribution to the ZDeutsch community and for taking the time to submit your correction.</p>",
    "          <p style=\"margin:0 0 12px;\">After reviewing your submission with the ZDeutsch community, we decided not to accept this answer at the moment.</p>",
    `          <p style="margin:0 0 8px;"><strong>Theme:</strong> ${safeTheme}</p>`,
    `          <p style="margin:0 0 18px;"><strong>Part:</strong> ${safePart}</p>`,
    "          <p style=\"margin:0 0 12px;\">If you believe your answer is correct, you are welcome to submit it again with a stronger explanation, or contact us on WhatsApp and convince us there.</p>",
    `          <p style="margin:0 0 4px;"><strong>${safeSenderName}</strong></p>`,
    `          <p style="margin:0 0 4px;"><strong>Email:</strong> <a href="mailto:${safeSenderEmail}" style="color:#2563eb;text-decoration:none;">${safeSenderEmail}</a></p>`,
    `          <p style="margin:0 0 4px;"><strong>Phone / WhatsApp:</strong> ${whatsappUrl ? `<a href="${escapeHtml(whatsappUrl)}" style="color:#2563eb;text-decoration:none;">${safeContactPhone}</a>` : safeContactPhone}</p>`,
    `          ${whatsappUrl ? `<p style="margin:0 0 18px;"><strong>WhatsApp:</strong> <a href="${escapeHtml(whatsappUrl)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(whatsappUrl)}</a></p>` : ""}`,
    "          <p style=\"margin:0 0 12px;\">We appreciate your contribution and will be glad to review a new submission from you.</p>",
    "          <p style=\"margin:0 0 0;\">With sincere thanks,</p>",
    `          <p style="margin:6px 0 0;"><strong>${safeSenderName}</strong></p>`,
    "        </section>",
    "      </div>",
    "    </div>",
    "  </body>",
    "</html>"
  ].join("\n");
}

async function sendContributionEmail({
  recipientEmail,
  subject,
  textBody,
  htmlBody,
  successMessage,
  failurePrefix
}) {
  const config = getMailConfig();

  if (!recipientEmail) {
    return {
      status: "skipped",
      message: "Contributor email is missing."
    };
  }

  if (!config.senderEmail || !config.passwordVariants.length) {
    return {
      status: "skipped",
      message: "SMTP credentials are missing."
    };
  }

  try {
    await sendViaPython(config, {
      recipientEmail,
      subject,
      textBody,
      htmlBody
    });
    return {
      status: "sent",
      message: successMessage || `Email sent to ${recipientEmail}.`
    };
  } catch (pythonError) {
    console.error("[ContributionEmail][python]", pythonError.message);

    try {
      await sendViaSocket(config, {
        recipientEmail,
        subject,
        textBody,
        htmlBody
      });
      return {
        status: "sent",
        message: successMessage || `Email sent to ${recipientEmail}.`
      };
    } catch (socketError) {
      console.error("[ContributionEmail][socket]", socketError.message);
      return {
        status: "failed",
        message: `${failurePrefix || "Email sending failed"}: ${socketError.message}`
      };
    }
  }
}

async function sendAcceptedContributionEmail({ recipientEmail, themeTitle, partLabel }) {
  const config = getMailConfig();
  return sendContributionEmail({
    recipientEmail,
    subject: "Thank you for your contribution to ZDeutsch",
    textBody: buildAcceptedContributionTextBody({
      themeTitle,
      partLabel,
      senderName: config.senderName,
      senderEmail: config.senderEmail,
      contactPhone: config.contactPhone
    }),
    htmlBody: buildAcceptedContributionHtmlBody({
      themeTitle,
      partLabel,
      senderName: config.senderName,
      senderEmail: config.senderEmail,
      contactPhone: config.contactPhone
    }),
    successMessage: `Thank-you email sent to ${recipientEmail}.`,
    failurePrefix: "Accepted contribution saved, but the thank-you email failed"
  });
}

async function sendRejectedContributionEmail({ recipientEmail, themeTitle, partLabel }) {
  const config = getMailConfig();
  return sendContributionEmail({
    recipientEmail,
    subject: "Update on your contribution to ZDeutsch",
    textBody: buildRejectedContributionTextBody({
      themeTitle,
      partLabel,
      senderName: config.senderName,
      senderEmail: config.senderEmail,
      contactPhone: config.contactPhone
    }),
    htmlBody: buildRejectedContributionHtmlBody({
      themeTitle,
      partLabel,
      senderName: config.senderName,
      senderEmail: config.senderEmail,
      contactPhone: config.contactPhone
    }),
    successMessage: `Review email sent to ${recipientEmail}.`,
    failurePrefix: "Contribution was refused, but the review email failed"
  });
}

async function sendViaSocket(config, { recipientEmail, subject, textBody, htmlBody }) {
  let socket = null;
  let session = null;

  const attempt = async (password) => {
    if (session) {
      try {
        session.sendLine("QUIT");
      } catch (quitError) {
        // best effort
      }
    }
    if (socket) {
      socket.end();
      socket.destroy();
    }

    socket = tls.connect({
      host: config.host,
      port: config.port,
      servername: config.host,
      timeout: 15000
    });
    session = createSmtpSession(socket);

    await new Promise((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });

    await expectResponse(session, "220");
    session.sendLine(`EHLO ${(os.hostname() || "localhost").replace(/[^a-zA-Z0-9.-]/g, "") || "localhost"}`);
    await expectResponse(session, "250");

    session.sendLine("AUTH LOGIN");
    await expectResponse(session, "334");
    session.sendLine(Buffer.from(config.senderEmail, "utf8").toString("base64"));
    await expectResponse(session, "334");
    session.sendLine(Buffer.from(password, "utf8").toString("base64"));
    await expectResponse(session, "235");

    session.sendLine(`MAIL FROM:<${config.senderEmail}>`);
    await expectResponse(session, "250");
    session.sendLine(`RCPT TO:<${recipientEmail}>`);
    await expectResponse(session, ["250", "251"]);
    session.sendLine("DATA");
    await expectResponse(session, "354");

    const message = createMessage({
      to: recipientEmail,
      subject,
      textBody,
      htmlBody,
      fromName: config.senderName,
      fromEmail: config.senderEmail
    });

    session.sendData(`${message}\r\n.\r\n`);
    await expectResponse(session, "250");
    session.sendLine("QUIT");
    await expectResponse(session, "221");
  };

  try {
    await tryPasswordVariants(config.passwordVariants, attempt);
  } finally {
    if (session) {
      try {
        session.sendLine("QUIT");
      } catch (quitError) {
        // best effort
      }
    }
    if (socket) {
      socket.end();
      socket.destroy();
    }
  }
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        const message = String(stderr || error.message || "Command failed").trim();
        reject(new Error(message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function sendViaPython(config, { recipientEmail, subject, textBody, htmlBody }) {
  const script = `
import os
import smtplib
from email.message import EmailMessage

passwords = []
raw_password = os.environ.get("MAIL_PASSWORD_RAW", "").strip()
compact_password = os.environ.get("MAIL_PASSWORD_COMPACT", "").strip()
for candidate in (raw_password, compact_password):
    if candidate and candidate not in passwords:
        passwords.append(candidate)

if not passwords:
    raise RuntimeError("SMTP credentials are missing.")

last_error = None
for password in passwords:
    try:
        msg = EmailMessage()
        msg["Subject"] = os.environ["MAIL_SUBJECT"]
        msg["From"] = f'{os.environ["MAIL_FROM_NAME"]} <{os.environ["MAIL_FROM_EMAIL"]}>'
        msg["To"] = os.environ["MAIL_TO_EMAIL"]
        msg.set_content(os.environ["MAIL_BODY_TEXT"])
        msg.add_alternative(os.environ["MAIL_BODY_HTML"], subtype="html")

        with smtplib.SMTP_SSL(os.environ["MAIL_HOST"], int(os.environ["MAIL_PORT"]), timeout=20) as smtp:
            smtp.login(os.environ["MAIL_FROM_EMAIL"], password)
            smtp.send_message(msg)
        print("MAIL_SENT")
        raise SystemExit(0)
    except Exception as exc:
        last_error = exc

raise RuntimeError(str(last_error) if last_error else "Failed to send email")
`.trim();

  await execFileAsync("python3", ["-c", script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MAIL_HOST: config.host,
      MAIL_PORT: String(config.port),
      MAIL_FROM_EMAIL: config.senderEmail,
      MAIL_FROM_NAME: config.senderName,
      MAIL_TO_EMAIL: recipientEmail,
      MAIL_SUBJECT: subject,
      MAIL_BODY_TEXT: textBody,
      MAIL_BODY_HTML: htmlBody,
      MAIL_PASSWORD_RAW: config.passwordVariants[0] || "",
      MAIL_PASSWORD_COMPACT: config.passwordVariants[1] || ""
    },
    maxBuffer: 1024 * 1024
  });
}

module.exports = {
  sendAcceptedContributionEmail,
  sendRejectedContributionEmail
};
