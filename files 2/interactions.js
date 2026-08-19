export const config = {
  api: {
    bodyParser: false,
  },
};

import { verifyKey, InteractionType, InteractionResponseType } from "discord-interactions";

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "falllendev";
const REPO = "Cat-bot";
const MAX_OWNED = 20;

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function getMarket() {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/market.json`, {
    headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Accept": "application/vnd.github+json" }
  });
  if (!res.ok) return { market: { photos: {}, ownership: {} }, sha: undefined };
  const data = await res.json();
  let market = { photos: {}, ownership: {} };
  try { market = JSON.parse(decodeURIComponent(escape(atob(data.content)))); } catch (e) {}
  return { market, sha: data.sha };
}

async function saveMarket(market, sha) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/market.json`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Accept": "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Update market via claim",
      content: btoa(unescape(encodeURIComponent(JSON.stringify(market, null, 2)))),
      sha
    })
  });
  return res.ok;
}

export default async function handler(req, res) {
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  const rawBody = await getRawBody(req);

  const isValid = verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);
  if (!isValid) {
    return res.status(401).send("Bad request signature");
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === InteractionType.PING) {
    return res.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const commandName = interaction.data.name;

    if (commandName === "fatcat") {
      try {
        const listRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/`);
        const files = await listRes.json();
        const images = files.filter(f => /\.(jpe?g|png|gif)$/i.test(f.name));
        const pick = images[Math.floor(Math.random() * images.length)];
        const imageUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${encodeURIComponent(pick.name)}`;

        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: imageUrl }
        });
      } catch (e) {
        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "Couldn't fetch a cat photo right now, try again in a bit." }
        });
      }
    }

    if (commandName === "mycats") {
      const userId = interaction.member?.user?.id || interaction.user?.id;
      try {
        const marketRes = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/main/market.json?cachebust=${Date.now()}`);
        const market = marketRes.ok ? await marketRes.json() : { ownership: {}, photos: {} };
        const owned = Object.entries(market.ownership || {}).filter(([, ownerId]) => ownerId === userId).map(([photo]) => photo);

        if (owned.length === 0) {
          return res.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: "You don't own any photos yet — watch the market channel and claim one!", flags: 64 }
          });
        }

        const totalValue = owned.reduce((sum, p) => sum + (market.photos[p]?.value || 0), 0);
        const list = owned.map(p => `• ${p} — ${market.photos[p]?.value || "?"} coins`).join("\n");

        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `**Your collection (${owned.length}/${MAX_OWNED}):**\n${list}\n\nEst. total value: ${totalValue} coins`, flags: 64 }
        });
      } catch (e) {
        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "Couldn't load your collection right now.", flags: 64 }
        });
      }
    }
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = interaction.data.custom_id || "";

    if (customId.startsWith("claim:")) {
      const photo = customId.slice("claim:".length);
      const userId = interaction.member?.user?.id || interaction.user?.id;
      const username = interaction.member?.user?.username || interaction.user?.username || "someone";

      const { market, sha } = await getMarket();
      market.ownership = market.ownership || {};
      market.photos = market.photos || {};

      if (market.ownership[photo]) {
        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "Too late — someone already claimed this one!", flags: 64 }
        });
      }

      const ownedCount = Object.values(market.ownership).filter(id => id === userId).length;
      if (ownedCount >= MAX_OWNED) {
        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `You already own the max of ${MAX_OWNED} photos! Trade one away first.`, flags: 64 }
        });
      }

      market.ownership[photo] = userId;
      const saved = await saveMarket(market, sha);

      if (!saved) {
        return res.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "Someone claimed this right as you clicked — try the next one!", flags: 64 }
        });
      }

      const value = market.photos[photo]?.value || "?";
      return res.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: `✅ **Claimed by ${username}!** Value: ${value} coins`,
          components: []
        }
      });
    }
  }

  return res.status(400).send("Unknown interaction type");
}
