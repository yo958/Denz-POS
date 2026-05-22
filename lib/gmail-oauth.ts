import { google } from 'googleapis';

export function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID!,
    process.env.GMAIL_CLIENT_SECRET!,
    process.env.GMAIL_REDIRECT_URI!,
  );
}

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

export const TOKEN_DOC_PATH =
  process.env.NODE_ENV === 'production'
    ? 'venue-settings/gmail-prod'
    : 'venue-settings/gmail-dev';
