// Push notifications (IOS-7, BR-R7). One small interface; APNs is the POC implementation (needs the Apple Developer Program).
import http2 from "node:http2";
import { SignJWT, importPKCS8 } from "jose";
import { systemClock, type Clock } from "./clock";

export interface PushMessage { title: string; body: string; data?: Record<string, string> }
export interface PushResult { sent: number; failed: number; invalid: string[] }
export interface PushSender { send(tokens: string[], msg: PushMessage): Promise<PushResult> }

export class ConsolePushSender implements PushSender {
  async send(tokens: string[], msg: PushMessage) { console.log(`[push] to=${tokens.length} device(s) title=${msg.title} body=${msg.body}`); return { sent: tokens.length, failed: 0, invalid: [] }; }
}
/** Test double that keeps what was sent. */
export class MemoryPushSender implements PushSender {
  sent: { token: string; msg: PushMessage }[] = [];
  async send(tokens: string[], msg: PushMessage) { for (const token of tokens) this.sent.push({ token, msg }); return { sent: tokens.length, failed: 0, invalid: [] }; }
}

export interface ApnsConfig { keyP8: string; keyId: string; teamId: string; bundleId: string; sandbox: boolean }
/** Token-based APNs over HTTP/2. Not exercised against Apple in tests: it needs real credentials and a real device token. */
export class ApnsPushSender implements PushSender {
  private jwt?: { token: string; at: number };
  constructor(private cfg: ApnsConfig, private clock: Clock = systemClock) {}
  private async bearer() {
    if (this.jwt && this.clock.now().getTime() - this.jwt.at < 40 * 60_000) return this.jwt.token; // APNs wants a fresh token every 20-60 min
    const key = await importPKCS8(this.cfg.keyP8.replace(/\\n/g, "\n"), "ES256");
    const token = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: this.cfg.keyId }).setIssuer(this.cfg.teamId).setIssuedAt().sign(key);
    this.jwt = { token, at: this.clock.now().getTime() };
    return token;
  }
  async send(tokens: string[], msg: PushMessage): Promise<PushResult> {
    const host = this.cfg.sandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
    const bearer = await this.bearer();
    const client = http2.connect(host);
    const body = JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: "default" }, ...(msg.data ?? {}) });
    const out: PushResult = { sent: 0, failed: 0, invalid: [] };
    try {
      await Promise.all(tokens.map((t) => new Promise<void>((resolve) => {
        const req = client.request({ ":method": "POST", ":path": `/3/device/${t}`, authorization: `bearer ${bearer}`, "apns-topic": this.cfg.bundleId, "apns-push-type": "alert", "content-type": "application/json" });
        let status = 0;
        req.on("response", (h) => { status = Number(h[":status"]); });
        req.on("data", () => {});
        req.on("end", () => { if (status === 200) out.sent++; else { out.failed++; if (status === 410 || status === 400) out.invalid.push(t); } resolve(); });
        req.on("error", () => { out.failed++; resolve(); });
        req.end(body);
      })));
    } finally { client.close(); }
    return out;
  }
}
