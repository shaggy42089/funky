/**
 * 
 * launch this script to update slash commands
 * 
*/

import { ChannelType, REST, Routes } from 'discord.js';
import  { SlashCommandBuilder } from '@discordjs/builders';
import { config } from './.config.js'

const commands = [
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('play a song or adds it to the list')
      .addStringOption((option) => option
          .setName('song')
          .setDescription('The song you are looking for, can be a yt link')
          .setRequired(true)),
          
    new SlashCommandBuilder().setName('skip').setDescription('skips the current song'),    
    new SlashCommandBuilder().setName('clear').setDescription('clears the queue'),
    new SlashCommandBuilder().setName('status').setDescription('show queue status'),

    new SlashCommandBuilder().setName('pause').setDescription('pauses the current song'),
    new SlashCommandBuilder().setName('resume').setDescription('resume a paused song'),
		new SlashCommandBuilder().setName('exit').setDescription('shuts down the bot'),
    new SlashCommandBuilder().setName('leave').setDescription('make the bot leave the voice channel it is connected to'),

    new SlashCommandBuilder()
    .setName('join')
    .setDescription('make the bot join the channel')
    .addChannelOption((option) => option
        .setName('channel')
        .setDescription('channel to join, default is the one you\'re in')
				.setRequired(false)
        .addChannelTypes(ChannelType.GuildVoice)),
    new SlashCommandBuilder()
    .setName('say')
    .setDescription('make the bot talk')
    .addStringOption((option) => option
        .setName('text')
        .setRequired(true)
        .setDescription('text to say')),
]
.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

try {
  console.log('Started refreshing application (/) commands.');

  await rest.put(Routes.applicationCommands(config.client_id), { body: commands });

  console.log('Successfully reloaded application (/) commands.');
} catch (error) {
  console.error(error);
}