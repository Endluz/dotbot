import { refreshAccessToken } from '../utils/twitchAuth.js';
import fs from 'fs';

const tokenPath = './twitch_tokens.json';

export async function startTwitchTokenRefresher() {
  if (!fs.existsSync(tokenPath)) {
    console.warn('⚠️ No token file found. Skipping Twitch token refresh setup.');
    return;
  }

  const raw = fs.readFileSync(tokenPath);
  const tokens = JSON.parse(raw);
  let { refresh_token } = tokens;

  const refreshAndSave = async () => {
    try {
      const newTokens = await refreshAccessToken(refresh_token);
      refresh_token = newTokens.refresh_token;

      fs.writeFileSync(tokenPath, JSON.stringify(newTokens, null, 2));
      console.log('🔁 Twitch access token refreshed successfully.');
    } catch (err) {
      console.error('❌ Failed to refresh Twitch token:', err.message || err);
    }
  };

  // Refresh immediately on startup
  await refreshAndSave();

  // Refresh every 55 minutes
  setInterval(refreshAndSave, 55 * 60 * 1000);
}
