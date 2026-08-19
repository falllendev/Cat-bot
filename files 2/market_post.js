const fs = require("fs");

const owner = "falllendev";
const repo = "Cat-bot";
const botToken = process.env.DISCORD_BOT_TOKEN;
const MARKET_CHANNEL_ID = "1539772559975915580";

async function main() {
  if (!botToken) throw new Error("DISCORD_BOT_TOKEN environment variable is not set");

  let market = { photos: {}, ownership: {} };
  try { market = JSON.parse(fs.readFileSync("market.json", "utf-8")); } catch (e) {}
  market.photos = market.photos || {};
  market.ownership = market.ownership || {};

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`);
  if (!res.ok) throw new Error(`GitHub API failed: ${res.status}`);
  const files = await res.json();
  const allImages = files.filter(f => /\.(jpe?g|png|gif)$/i.test(f.name)).map(f => f.name);

  const unclaimed = allImages.filter(name => !market.ownership[name]);

  if (unclaimed.length === 0) {
    console.log("No unclaimed photos left this cycle — skipping listing.");
    return;
  }

  const pick = unclaimed[Math.floor(Math.random() * unclaimed.length)];
  const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${encodeURIComponent(pick)}`;

  const timesPosted = (market.photos[pick]?.timesPosted || 0) + 1;
  const baseValue = 1000;
  const variance = 0.9 + Math.random() * 0.2;
  const value = Math.round((baseValue / (timesPosted + 1)) * variance);
  market.photos[pick] = { timesPosted, value };

  const postRes = await fetch(`https://discord.com/api/v10/channels/${MARKET_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${botToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: `🐾 **New listing!** Est. value: **${value} coins** (posted ${timesPosted}x before)\n${imageUrl}`,
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 3,
          label: "Claim this photo",
          custom_id: `claim:${pick}`
        }]
      }]
    })
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`Discord post failed: ${postRes.status} ${err}`);
  }
  const posted = await postRes.json();

  market.currentListing = { photo: pick, messageId: posted.id, channelId: MARKET_CHANNEL_ID, postedAt: new Date().toISOString() };

  fs.writeFileSync("market.json", JSON.stringify(market, null, 2));
  console.log("Listed:", pick, "| Value:", value, "| Times posted:", timesPosted);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
