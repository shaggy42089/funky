import { GatewayIntentBits, Client } from 'discord.js'
import { 
	getVoiceConnections
} from '@discordjs/voice'

import { config } from './.config.js'
import { 
	funkyPause,
	funkyResume,
	funkySkip,
	funkyJoin,
	funkyStatus,
	funkyPlay,
	funkyClear
} from './funkyHelper.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

let queueMap = new Map()

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('guildCreate', guild => {
    if(!config.guildWhitelist.includes(guild.id)) return guild.leave();
});

client.on('interactionCreate', async interaction => {
	try {
		if (!interaction.isCommand()) return false;

		if (interaction.commandName === 'join') {
			await interaction.deferReply();
			await funkyJoin(interaction, queueMap);
		}

		if (interaction.commandName === 'leave') {
			let connections = getVoiceConnections()
			let chan = connections.get(interaction.guildId)
			if (chan) {
				chan.destroy();
				let queue = queueMap.get(interaction.guildId)
				queue.player.stop();
				queueMap.delete(interaction.guildId)
				await interaction.reply('succesfully disconnected')
				return;
			}

			await interaction.reply('I am not currently connected to a voice channel on this server')
		}

		if (interaction.commandName === 'play') {
			await funkyPlay(interaction, queueMap);
		}

		if (interaction.commandName === 'status') { 
			await funkyStatus(interaction, queueMap);
		}

		if (interaction.commandName === 'clear') {
			await funkyClear(interaction, queueMap);
		}

		if (interaction.commandName === 'skip') {
			await funkySkip(interaction, queueMap);
		}

		if (interaction.commandName === 'pause') {
			await funkyPause(interaction, queueMap);
		}

		if (interaction.commandName === 'resume') {
			await funkyResume(interaction, queueMap);
		}

		if (interaction.commandName === 'exit') {
			queueMap.forEach(queue => {
				queue.player.stop()
				queue.player = undefined;
			})

			getVoiceConnections().forEach(vc => {
				vc.disconnect();
			})

			await interaction.reply('bye bye')
			client.destroy()
			exit ();
		}

	} catch (err) {
		console.log(err)
	}
	
});

client.login(config.token);