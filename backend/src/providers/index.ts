import { env } from '../env.js';
import type { EmailProvider } from '../types/index.js';
import { smtpProvider } from './smtp.provider.js';
import { emailjsProvider } from './emailjs.provider.js';
import { sendDisabledByEnv } from '../campaigns/killSwitch.js';

/* The one door every outgoing mail passes (campaign, test, confirmation, contact form, owner notice). SEND_ENABLED=false closes it for all of them, checked on each lookup so no path can forget. */
const held: EmailProvider = {
  async send() {
    return { ok: false, error: 'Sending is disabled (SEND_ENABLED=false)', kind: 'policy' };
  },
};

export function getProvider(): EmailProvider {
  if (sendDisabledByEnv()) return held;
  return env.EMAIL_PROVIDER === 'emailjs' ? emailjsProvider : smtpProvider;
}
