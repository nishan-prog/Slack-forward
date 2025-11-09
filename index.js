// index.js
import pkg from "@slack/bolt";
const { App } = pkg;
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
const stateFile = "./state.json";

// Load or initialize state
let state = { forwarded: [] };
try {
  state = JSON.parse(fs.readFileSync(stateFile));
} catch {
  console.log("No state.json found, starting fresh.");
}

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Listen to all messages in DMs (im)
app.event("message", async ({ event, client }) => {
  try {
    if (!event.user || event.subtype === "bot_message") return;
    if (event.channel_type !== "im") return;

    // Get recipient (user being messaged)
    const convo = await client.conversations.members({ channel: event.channel });
    const recipient = convo.members.find((id) => id !== event.user);
    if (!recipient) return;

    // Only forward if the recipient has auto-reply enabled
    // We check by seeing if they exist in the auto-reply bot’s state
    const autoReplyBotChannel = process.env.AUTO_REPLY_BOT_CHANNEL;
    await client.chat.postMessage({
      channel: autoReplyBotChannel,
      text: `[${recipient}] ${event.text}`, // format expected by auto-reply bot
    });

    // Log forwarded message
    state.forwarded.push({ to: recipient, from: event.user, text: event.text });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error("Forwarding error:", err);
  }
});

// Start the forwarder
const port = process.env.PORT || 4000;
(async () => {
  await app.start(port);
  console.log(`🚀 Forwarder bot running on port ${port}`);
})();
