// Mail transport. Local/dev: ConsoleMailer. POC deploy: Gmail SMTP (app password) or Resend over its HTTP API.
export interface Mail {
  to: string;
  subject: string;
  html: string;
}
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  async send(mail: Mail) {
    console.log(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.html}`);
  }
}

// Test double that keeps what was sent.
export class MemoryMailer implements Mailer {
  sent: Mail[] = [];
  async send(mail: Mail) {
    this.sent.push(mail);
  }
}

export class ResendMailer implements Mailer {
  constructor(private apiKey: string, private from: string) {}
  async send(mail: Mail) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: mail.to, subject: mail.subject, html: mail.html }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
  }
}

// Gmail (or any SMTP) with an app password: delivers to any address, no domain needed.
export class SmtpMailer implements Mailer {
  constructor(private user: string, private pass: string, private from: string, private host = "smtp.gmail.com") {}
  async send(mail: Mail) {
    const { createTransport } = await import("nodemailer");
    const t = createTransport({ host: this.host, port: 465, secure: true, auth: { user: this.user, pass: this.pass } });
    await t.sendMail({ from: this.from, to: mail.to, subject: mail.subject, html: mail.html });
  }
}

// Local/test only: writes each mail as a JSON file so E2E tests can read verification links (no Mailpit/Docker needed).
export class FileMailer implements Mailer {
  constructor(private dir: string) {}
  async send(mail: Mail) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(this.dir, { recursive: true });
    const name = `${String(process.hrtime.bigint()).padStart(20, "0")}.json`; // sortable by send order
    writeFileSync(`${this.dir}/${name}`, JSON.stringify(mail));
  }
}
