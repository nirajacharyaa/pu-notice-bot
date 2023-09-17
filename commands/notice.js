import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("notice")
    .setDescription("Notice from PU"),

  async execute(interaction) {
    await interaction.reply("नोटिस आएसी आफै भन्छु !");
  },
};
