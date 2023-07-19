import { GatewayIntentBits, Client } from 'discord.js'
import { 
	joinVoiceChannel, 
	getVoiceConnections,
	createAudioPlayer,
	NoSubscriberBehavior,
	createAudioResource,  
	AudioPlayer,
	AudioPlayerStatus
} from '@discordjs/voice'

import { config } from './.config.js'
import ytdl from 'ytdl-core'
import { fetchQueue } from './funkyHelper.js'
import AsyncLock from 'async-lock'

const getInfo = ytdl.getInfo

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

let mapLock = new AsyncLock()
let queueMap = new Map()

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('guildCreate', (guild) => {
    if(!config.guildWhitelist.includes(guild.id)) return guild.leave();
});

client.on('interactionCreate', async interaction => {
	try {
		if (!interaction.isCommand()) return;

		if (interaction.commandName === 'join') {
			let chan = interaction.options.getChannel('channel') || interaction.member.voice.channel

			if (!chan) {
				await interaction.reply('no channel provided and you are not in a voice channel')
				return;
			} 

			let conn = joinVoiceChannel({
				channelId: chan.id,
				guildId: interaction.guildId,
				selfDeaf: false,
				selfMute: false,
				adapterCreator: interaction.guild.voiceAdapterCreator
			})

			let player = createAudioPlayer({
				behaviors: {
					noSubscriber: NoSubscriberBehavior.Pause,
				},
			});

			let queueLock = new AsyncLock()

			let queue = {
				player: player,
				channel: chan,
				lock: queueLock,
				songs : [],
				volume : 5,
				playing : false
			}

			mapLock.acquire('queueMapLock', () => {
				queueMap.set(interaction.guildId, queue)
			})
			
			player.on(AudioPlayerStatus.Idle, () => {
				queue.lock.acquire('queueLock', () => {
					queue.songs.shift();
					if (!queue.songs.length) {
						queue.playing = false;
						return;
					} else {
						const video = ytdl(songs[0].url,{ filter: 'audioonly' });
						const res = createAudioResource(video)
						queue.player.play(res);
					}
				})
			})

			conn.subscribe(player)			

			await interaction.reply('Here I am!')
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
			await interaction.deferReply()

			await fetchQueue(interaction, queueMap, async (queue) => {
				let songOption = interaction.options.getString('song')
				let songInfos = await getInfo(songOption)

				let song = {
					title: songInfos.videoDetails.title,
					url: songInfos.videoDetails.video_url,
				}

				queue.lock.acquire('queueLock', async () => {
					queue.songs.push(song)
				
					if (!queue.playing) {
						queue.playing = true;
						try {
							const video = ytdl(song.url,{ filter: 'audioonly' });
							const res = createAudioResource(video)
							queue.player.play(res);
						} catch (e) {
							await interaction.editReply(`Something went wrong: ${e}`);
							return;
						}
					}
				})
				
				await interaction.editReply(song.title + ' is now playing')
			})
		}

		if (interaction.commandName === 'status') { 
			await fetchQueue(interaction, queueMap, async (queue) => {
				await interaction.reply('currently ' + (queue.playing ? ('playing ' + queue.songs[0].title) : 'not '))
			});
		}

		if (interaction.commandName === 'clear') {
			await fetchQueue(interaction, queueMap, async (queue) => {
				queue.player.stop()
				queue.playing = false;
				queue.songs = []
				await interaction.reply('Queue has been cleared')
			});
		}

		if (interaction.commandName === 'skip') {
			await fetchQueue(interaction, queueMap, async (queue) => {
				queue.lock.acquire('queueLock', async () => {
					if (!queue.songs.length) {
						await interaction.reply('Nothing to skip bud !')
						return;	
					}

					queue.songs.shift()
					if (queue.songs.length) {
						const video = ytdl(queue.songs[0].url,{ filter: 'audioonly' });
						const res = createAudioResource(video)
						queue.player.play(res)
					}
					await interaction.reply('skipped !')
				})
			})
		}

		if (interaction.commandName === 'pause') {
			await fetchQueue(interaction, queueMap, async () => {
				queue.player.pause()
				queue.playing = false;
				await interaction.reply('Queue has been paused')
			})

			await interaction.reply('There is no queue to pause')
		}

		if (interaction.commandName === 'resume') {
			await fetchQueue(interaction, queueMap, async (queue) => {
				queue.player.unpause()
				queue.playing = true;
				await interaction.reply('Queue has been resumed')
			})

			await interaction.reply('There is no queue to resume')
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
		}

	} catch (err) {
		console.log(err)
	}
	
});

client.login(config.token);