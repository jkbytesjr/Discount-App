// Mail transport. Local/dev: ConsoleMailer. POC deploy: Resend over its HTTP API.
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
