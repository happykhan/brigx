interface Env {
  POSTMARK_SERVER_TOKEN: string;
  POSTMARK_FROM: string;
  BUG_REPORT_TO: string;
  TURNSTILE_SECRET_KEY: string;
}

interface Context {
  request: Request;
  env: Env;
}

interface BugReport {
  happened?: unknown;
  expected?: unknown;
  steps?: unknown;
  email?: unknown;
  debugOutput?: unknown;
  turnstileToken?: unknown;
  environment?: {
    appVersion?: unknown;
    page?: unknown;
    userAgent?: unknown;
  };
}

const limits = {
  happened: 4000,
  expected: 2000,
  steps: 4000,
  email: 254,
  debugOutput: 12_000,
  environment: 1000,
};

function text(value: unknown, maximum: number, required = false): string {
  if (typeof value !== 'string') {
    if (required) throw new Error('Please complete all required fields.');
    return '';
  }
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error('Please complete all required fields.');
  if (cleaned.length > maximum) throw new Error('One or more fields are too long.');
  return cleaned;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'Invalid request.' }, 415);
  }

  let report: BugReport;
  try {
    report = await request.json() as BugReport;
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  try {
    const happened = text(report.happened, limits.happened, true);
    const expected = text(report.expected, limits.expected, true);
    const steps = text(report.steps, limits.steps, true);
    const email = text(report.email, limits.email);
    const debugOutput = text(report.debugOutput, limits.debugOutput);
    const turnstileToken = text(report.turnstileToken, 2048, true);
    const appVersion = text(report.environment?.appVersion, limits.environment);
    const page = text(report.environment?.page, limits.environment);
    const userAgent = text(report.environment?.userAgent, limits.environment);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Enter a valid email address.' }, 400);
    }

    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get('CF-Connecting-IP') || undefined,
      }),
    });
    const verificationResult = await verification.json() as { success?: boolean };
    if (!verificationResult.success) return json({ error: 'Please complete the verification and try again.' }, 400);

    const message = [
      'What happened?', happened,
      '', 'What was expected?', expected,
      '', 'Steps to reproduce', steps,
      '', `BRIGX version: ${appVersion || 'Unknown'}`,
      `Page: ${page || 'Unknown'}`,
      `Browser: ${userAgent || 'Unknown'}`,
      email ? `Reporter: ${email}` : 'Reporter: No email supplied',
      debugOutput ? `\nDebug output\n${debugOutput}` : '',
    ].filter(Boolean).join('\n');

    const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN,
      },
      body: JSON.stringify({
        From: env.POSTMARK_FROM,
        To: env.BUG_REPORT_TO,
        ReplyTo: email || undefined,
        Subject: `BRIGX bug report${appVersion ? ` — v${appVersion}` : ''}`,
        TextBody: message,
        MessageStream: 'outbound',
        Tag: 'brigx-bug-report',
      }),
    });

    if (!postmarkResponse.ok) {
      console.error('Postmark rejected bug report', postmarkResponse.status, await postmarkResponse.text());
      return json({ error: 'The report could not be sent. Please try again.' }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid report.' }, 400);
  }
}
