import { env } from '../env.js';
import type { EmailProvider } from '../types/index.js';
import { smtpProvider } from './smtp.provider.js';
import { emailjsProvider } from './emailjs.provider.js';
import { instrumentProvider } from '../metrics.js';
import { sendDisabledByEnv } from '../campaigns/killSwitch.js';

/* The one door every outgoing mail passes (campaign, test, confirmation, contact form, owner notice). SEND_ENABLED not being on closes it for all of them, checked on each lookup so no path can forget. */
const held: EmailProvider = {
  async send() {
    return { ok: false, error: 'Sending is disabled (SEND_ENABLED is not true)', kind: 'policy' };
  },
};

export function getProvider(): EmailProvider {
  if (sendDisabledByEnv()) return instrumentProvider(held);
  return instrumentProvider(env.EMAIL_PROVIDER === 'emailjs' ? emailjsProvider : smtpProvider);
}
