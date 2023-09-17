import "dotenv/config";
import Parser from "rss-parser";
import { load } from "cheerio";
import Discord from "discord.js";
import cron from "cron";
import sqlite3 from "sqlite3";

import fs from "fs";
import path, { dirname } from "path";
import { Collection } from "discord.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const feedUrl = "https://pu.edu.np/notice/feed/";
let latestPostPubDate = null;

const db = new sqlite3.Database(
  "./db.sqlite",
  sqlite3.OPEN_READWRITE || sqlite3.OPEN_CREATE, // create a db.sqlite first, then run the script
  (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Connected to the database.");
  }
);

db.run(
  "CREATE TABLE IF NOT EXISTS channels (id INTEGER PRIMARY KEY AUTOINCREMENT, channelId TEXT, serverId TEXT)"
);

const fetchChannels = async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT DISTINCT channelId FROM channels", [], (err, rows) => {
      if (err) {
        reject(err);
      }
      resolve(rows);
    });
  });
};

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMembers,
  ],
});

const checkForNewNotice = async () => {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL(feedUrl);
    const latestFeed = feed.items[0];
    if (latestPostPubDate === latestFeed.pubDate) {
      console.log("No New Notice Found");
      return;
    } else {
      console.log("New Notice Found");
      latestPostPubDate = latestFeed.pubDate;
      let markup = load(latestFeed["content:encoded"]);
      let image = markup("img").attr("src");

      console.log("channel here");
      const embedded = new Discord.EmbedBuilder()
        .setTitle(latestFeed.title)
        .setURL(latestFeed.link)
        .setImage(image)
        .setDescription(latestFeed?.content || " ")
        .setColor(0x0099ff)
        .setTimestamp();

      fetchChannels().then((channels) => {
        channels.forEach((channel) => {
          client.channels.fetch(channel.channelId).then((ch) => {
            ch.send({ embeds: [embedded] });
          });
        });
      });
    }
  } catch (err) {
    console.error("Error in fetching RSS Feed", err);
  }
};

client.on("messageCreate", async (message) => {
  if (message.content.startsWith("!setChannel")) {
    const mentionedChannel = message.mentions.channels.first();
    console.log("mentionedChannel", mentionedChannel);

    if (mentionedChannel) {
      const serverId = message.guild.id;
      const channelId = mentionedChannel.id;
      db.run(
        `INSERT INTO channels (channelId, serverId) VALUES (?, ?)`,
        [channelId, serverId],
        function (err) {
          if (err) {
            return console.log(err.message);
          }
          // get the last insert id
          console.log(`A row has been inserted with rowId ${this.lastID}`);
        }
      );

      message.channel.send(
        `Channel ${mentionedChannel.name} has been set for server ${message.guild.name}`
      );
    } else {
      message.channel.send("Please mention a channel");
    }
  }
  if (message.content === "!naradmuni") {
    message.channel.send("जिउदै छु, नोटिस आएसी पठाऊँछु !");
  }
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`Invalid command file ${file}`);
  }
}

client.once("ready", (cl) => {
  console.log(`Logged in as ${cl.user.tag}!`);
  cron.CronJob("*/5 * * * *", checkForNewNotice);
});

client.login(process.env.BOT_TOKEN);
