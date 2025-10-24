const { Client, request } = require("undici");
const WebSocket = require("ws");
const { readFile } = require("fs").promises;

let authCode = null;
const connList = [];
const maxConns = 1; 
const guildData = {};

const sarkilar = "MTMyMDQzMzgwMTQ4NjEzOTM5Mg.G1iaAM.PH9-RO2H4SxBGieMqT2fkSw2R-kqpyhseXE4Xo";
const sokaklara = "1421582566472945704";
const ait = "https://canary.discord.com/api/webhooks/1424176897285292043/NDwZbd8uNuz2AsXFWgCP7S52YZO1cGwDBks5fz0XpvwMQQEO4_SFxTBib9RSx2vF1nSQ";

function parseJson(text) {
  if (typeof text !== "string") return [];
  const pattern = /{[^{}]*}|\[[^\[\]]*\]/g;
  const found = text.match(pattern) || [];
  return found.reduce((acc, item) => {
    try {
      const obj = JSON.parse(item);
      if (obj) acc.push(obj);
    } catch {}
    return acc;
  }, []);
}
async function mfaauth() {
  try {
    authCode = (await readFile("mfa.txt", "utf8")).trim();
    console.log("bilinmeyen kisiler fixledi???");
  } catch (err) {
    console.error("sana mfa yok anca 60003:", err.message);
  }
}
function makeConn(id) {
  const client = new Client("https://canary.discord.com", {
    keepAliveTimeout: 60000,
    keepAliveMaxTimeout: 600000,
    pipelining: 10,
    connections: 3,
    connect: {
      rejectUnauthorized: false,
      timeout: 10000,
    },
    bodyTimeout: 10000,
    headersTimeout: 10000,
  });
  client.on("error", (err) => {
    client.close();
    connList[id] = makeConn(id);
  });
  client.on("close", () => {
    connList[id] = makeConn(id);
  });
  return client;
}
async function setupConns() {
  for (let i = 0; i < maxConns; i++) {
    connList[i] = makeConn(i);
  }
}
function xasasd2(client, verb, url, data, headers) {
  const payload = JSON.stringify(data);
  request(`https://canary.discord.com${url}`, {
    method: verb,
    headers: {
      authorization: sarkilar,
      "content-type": "application/json",
      ...headers,
    },
    body: payload,
    client,
  }).then(async ({ body, statusCode }) => {
    const text = await body.text();
    console.log(` ${verb} ${url} - ${statusCode}`);
    if (statusCode === 200) {
      const extracted = parseJson(text);
      const parsed = extracted.find((e) => e.code);
      if (parsed && parsed.code === data.code) {
        console.log(`\x1b[32m FİNGER SNAPED?: ${data.code}\x1b[0m`);
        notifySuccess(data.code, text);
      }
    }
  }).catch((err) => {
  });
}
function xlsxasd(code) {
  if (!authCode) {
    console.error("No auth code available");
    return;
  }
  const payload = { code };
  const headers = {
    cookie: `__Secure-recent_mfa=${authCode}`,
    "user-agent": "Mozilla/5.0",
    "x-super-properties": "eyJicm93c2VyIjoiQ2hyb21lIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiQ2hyb21lIiwiY2xpZW50X2J1aWxkX251bWJlciI6MzU1NjI0fQ==",
  };
  for (let i = 0; i < connList.length; i++) {
    xasasd2(connList[i], "PATCH", `/api/v9/guilds/${sokaklara}/vanity-url`, payload, headers);
    xasasd2(connList[i], "PATCH", `/api/v9/guilds/${sokaklara}/vanity-url`, payload, headers);
  }
}
function notifySuccess(vanityName, result) {
  const embed = {
    title: "fastest people's",
    description: `claimed url: ${vanityName}`,
    color: 0x4B0082,
    fields: [{ name: "Response", value: `\`${result.substring(0, 200)}\``, inline: false }],
    image: { url: "https://cdn.discordapp.com/attachments/1420860895390601246/1421626256595619874/986a434281cdb82e18e427dbfc5a7039.gif?ex=68d9b820&is=68d866a0&hm=b296cd67dee47653fa124c8a54713b5f59413760bc65a0048b526ba2425aced4&" },
    footer: { text: `discord.gg/${vanityName} • ${new Date().toLocaleTimeString()}` },
    timestamp: new Date().toISOString(),
  };
  request(ait, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: "@everyone", embeds: [embed] }),
  }).catch((err) => console.error("Webhook basarisiz:", err.message));
}
(async () => {
  await mfaauth();
  await setupConns();
  setInterval(mfaauth, 300000);
  const socket = new WebSocket("wss://gateway-us-east1-b.discord.gg", {
    perMessageDeflate: false,
  });
  socket.on("open", () => {
    socket._socket.setNoDelay(true);
    socket._socket.setKeepAlive(true, 30000);
    console.log("websockete baglanildi");
  });
  socket.on("close", (event) => {
    console.log(`WebSocket kapandi: ${event.reason} (${event.code})`);
    process.exit();
  });
  socket.on("error", (err) => {
    process.exit();
  });
  socket.on("message", async (message) => {
    let packet;
    try {
      packet = JSON.parse(message.toString());
    } catch (err) {
      return;
    }
    const { t: type, op: opcode, d: data } = packet;
    if (type === "GUILD_UPDATE") {
      const stored = guildData[data.guild_id];
      if (stored && stored !== data.vanity_url_code) {
        xlsxasd(stored);
        console.log(`\x1b[33mClaimed: ${stored} -> ${data.vanity_url_code}\x1b[0m`);
      }
    } else if (type === "READY") {
      data.guilds.forEach((guild) => {
        if (guild.vanity_url_code) {
          guildData[guild.id] = guild.vanity_url_code;
          console.log(`\x1b[34mVANİTY'S => ${guild.vanity_url_code}\x1b[0m`);
        }
      });
    }
    if (opcode === 10) {
      socket.send(
        JSON.stringify({
          op: 2,
          d: {
            token: sarkilar,
            intents: 1 << 0,
            properties: { os: "Linux", browser: "Firefox", device: "Firefox" },
          },
        })
      );
      setInterval(() => {
        socket.send(JSON.stringify({ op: 1, d: {}, s: null, t: "heartbeat" }));
      }, data.heartbeat_interval);
    } else if (opcode === 7) {
      process.exit();
    }
  });
})();
