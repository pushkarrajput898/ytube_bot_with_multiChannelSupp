import { google } from "googleapis";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

/* ================= LOAD CONTENT ================= */

const content = JSON.parse(fs.readFileSync("./keywords.json", "utf8"));
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- ENGINE 1: DARK PSYCHOLOGY (Main Channel) ---
function generateMainTitle() {
  const hook = pickRandom(content.main.hooks);
  const angle = pickRandom(content.main.angles);
  const tone = pickRandom(content.main.tones);
  return `${hook} — ${angle} | ${tone} #shorts`;
}

function generateMainDescription() {
  return `${pickRandom(content.main.descriptions)}\n\n${content.main.hashtags.join(" ")}`;
}

// --- ENGINE 2: MEME PAGE (Secondary Channel) ---
function generateMemeTitle() {
  const starter = pickRandom(content.memes.starters);
  const scenario = pickRandom(content.memes.scenarios);
  const emoji = pickRandom(content.memes.emojis);
  // Example output: "POV: the wifi goes out 💀 #shorts"
  return `${starter} ${scenario} ${emoji} #shorts`;
}

function generateMemeDescription() {
  return `${pickRandom(content.memes.descriptions)}\n\n${content.memes.hashtags.join(" ")}`;
}

/* ================= UPLOAD LOGIC ================= */

async function uploadForChannel({
  channelRefreshToken,
  driveRefreshToken,
  queueFolderId,
  uploadedFolderId,
  label,
  type // New Parameter: 'MAIN' or 'MEME'
}) {
  console.log(`\n━━━━━━━━━━ ${label} ━━━━━━━━━━`);

  // 1. Setup Auth
  const youtubeAuth = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET);
  youtubeAuth.setCredentials({ refresh_token: channelRefreshToken });
  const youtube = google.youtube({ version: "v3", auth: youtubeAuth });

  const driveAuth = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET);
  driveAuth.setCredentials({ refresh_token: driveRefreshToken });
  const drive = google.drive({ version: "v3", auth: driveAuth });

  // 2. Download Video
  console.log("🔍 Checking Drive queue…");
  const list = await drive.files.list({
    q: `'${queueFolderId}' in parents and trashed = false and mimeType contains 'video/'`,
    fields: "files(id, name)",
    pageSize: 1,
  });

  if (!list.data.files?.length) {
    console.log("⏳ No videos found.");
    return;
  }

  const file = list.data.files[0];
  console.log("🎥 Found video:", file.name);

  const stream = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "stream" }
  );

  // 3. GENERATE METADATA BASED ON TYPE
  let title, description;
  if (type === 'MEME') {
    title = generateMemeTitle();
    description = generateMemeDescription();
  } else {
    // Default to Main/Dark Psychology
    title = generateMainTitle();
    description = generateMainDescription();
  }

  console.log("\n📝 TITLE:", title);
  console.log("📄 DESC:", description.split('\n')[0] + "..."); // Print first line only to save space

  // 4. Upload
  const upload = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title, description },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    },
    media: { body: stream.data },
  });

  console.log("✅ Uploaded to YouTube:", upload.data.id);

  // 5. Move File
  await drive.files.update({
    fileId: file.id,
    addParents: uploadedFolderId,
    removeParents: queueFolderId,
  });

  console.log("📦 Moved to uploaded folder.");
}

/* ================= RUN ================= */

// Main Channel (Dark Psychology)
await uploadForChannel({
  channelRefreshToken: process.env.REFRESH_TOKEN_MAIN,
  driveRefreshToken: process.env.REFRESH_TOKEN_MAIN,
  queueFolderId: process.env.DRIVE_MAIN_QUEUE_ID,
  uploadedFolderId: process.env.DRIVE_MAIN_UPLOADED_ID,
  label: "MAIN CHANNEL",
  type: "MAIN" // <--- Selects the "Dark Psychology" logic
});

// Secondary Channel (Memes)
await uploadForChannel({
  channelRefreshToken: process.env.REFRESH_TOKEN_SECONDARY,
  driveRefreshToken: process.env.REFRESH_TOKEN_MAIN,
  queueFolderId: process.env.DRIVE_SECONDARY_QUEUE_ID,
  uploadedFolderId: process.env.DRIVE_SECONDARY_UPLOADED_ID,
  label: "SECONDARY CHANNEL",
  type: "MEME" // <--- Selects the "Meme" logic
});

console.log("\n🎉 All uploads finished!");
process.exit(0);