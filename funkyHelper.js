import { 
	joinVoiceChannel, 
	createAudioPlayer,
	NoSubscriberBehavior,
	createAudioResource,  
	AudioPlayerStatus
} from '@discordjs/voice'
import { config } from './.config.js'


import AsyncLock from 'async-lock'
import ytdl from 'ytdl-core'

import google from 'googleapis';

let youtube = false;
if (config.googleApiKey)  {
    youtube = google.google.youtube({
        version: 'v3',
        auth: config.googleApiKey,
    });
}

let mapLock = new AsyncLock()

const getInfo = ytdl.getInfo

async function getQueue(interaction, queueMap) {
    try {
        let queue = queueMap.get(interaction.guildId);

        if (!queue) {
            await interaction.reply('No queue to pause');
            return false;
        }

        return queue;
    } catch (e) {
        console.error(e);       
        await interaction.reply('An error has occured');
        return false;
    }
}

export async function funkyPause(interaction, queueMap) {
    try {
        let queue = await getQueue(interaction, queueMap);

        if (queue) {
            queue.lock.acquire('queueLock', async () => {
                queue.player.pause()
                queue.playing = false;
            })

            await interaction.reply('Queue has been paused');
            return true;
        }

        return false;
    } catch(e) {
        console.error(e);       
        await interaction.reply('An error has occured');
        return false;
    }
}

export async function funkyResume(interaction, queueMap) {
    try {
        let queue = await getQueue(interaction, queueMap);

        if (queue) {
            queue.lock.acquire('queueLock', async () => {
                queue.player.unpause()
                queue.playing = true;
            })
            
            await interaction.reply('Queue has been resumed')
            return true;
        }

        return false;       
    } catch(e) {
        console.error(e);       
        await interaction.reply('An error has occured')
        return false;
    }
}

export async function funkySkip(interaction, queueMap) {
    await interaction.deferReply();

    try {
        let queue = await getQueue(interaction, queueMap);

        if (queue) {
            queue.lock.acquire('queueLock', async () => {
                if (!(queue.songs.length)) {
                    await interaction.editReply('No song in queue')
                    return true;	
                } else {
                    playNextSong(queue);
                    await interaction.editReply('skipped !')
                    return true;
                }
            })
        }

        return false;
    } catch(e) {
        console.error(e);       
        await interaction.editReply('An error has occured');
        return false;
    }
}

async function createQueue(interaction, chan) {
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
        playing : false,
        vc: conn
    }

    return queue;
}

export async function playNextSong(queue) {
    if (!(queue.songs.length)) {
        return true;	
    }

    queue.songs.shift()
    if (queue.songs.length) {
        queue.playing = true;
        const video = ytdl(queue.songs[0].url,{ filter: 'audioonly' });
        const res = createAudioResource(video);
        queue.player.play(res);
    } else {
        queue.playing = false;
        queue.player.stop();
    }
}

export async function funkyJoin(interaction, queueMap) {
    await interaction.deferReply();
    
    if (queueMap.get(interaction.guildId)) {
        await interaction.editReply('I am already here !');
        return true;
    }

    let chan = interaction.options.getChannel('channel') || interaction.member.voice.channel || false

    if (!chan) {
        await interaction.editReply('no channel provided and you are not in a voice channel')
        return false;
    } 

    let queue = await createQueue(interaction, chan);

    mapLock.acquire('queueMapLock', () => {
        queueMap.set(interaction.guildId, queue)
    })
    
    queue.player.on(AudioPlayerStatus.Idle, () => {
        queue.lock.acquire('queueLock', () => {
            playNextSong(queue);
        })
    })

    queue.player.on('error', err => {
        console.error(`Error: ${err.message} with resource`);
    })

    queue.vc.subscribe(queue.player)			

    await interaction.editReply('Here I am!')
}

export async function funkyStatus(interaction, queueMap) {
    try {
        let queue = await getQueue(interaction, queueMap);

        if (queue) {
            queue.lock.acquire('queueLock', async () => {
                let ans = 'current state : ' + ((queue.playing && queue.songs.length) ? 'playing ' + queue.songs[0].title : 'not playing');
                ans += '\n queue state :' + (queue.songs.length ? '' : 'empty')
                let count = 0
                queue.songs.slice(0, 5).forEach(song => {
                    ans += '\n' + (++count) + '. ' + song.title
                })

                await interaction.reply(ans)
            })

            return true;
        }

        return false;
    } catch (e) {
        console.error(e);       
        await interaction.reply('An error has occured')
        return false;
    }    
}

export async function funkyPlay(interaction, queueMap) {
    try {
        await interaction.deferReply()

        if (!queueMap.get(interaction.guildId)) {
            await funkyJoin(interaction, queueMap);
        }

        let queue = await getQueue(interaction, queueMap);

        if (queue) {
            let songOption = interaction.options.getString('song')
            if (!songOption.startsWith('https://www.youtube.com') && !youtube) {
                await interaction.editReply(`your song must be a valid link to a youtube video`);
                return; 
            } else {
                const response = await youtube.search.list({
                    part: 'snippet',
                    q: songOption,
                    type: 'video',
                });

                const videos = response.data.items;
                const videoUrls = videos.map(video => `https://www.youtube.com/watch?v=${video.id.videoId}`);
                songOption = videoUrls[0];
            }

            try {
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
                await interaction.editReply(song.title + ' has been added to queue')
                return true;
            } catch (e) {
                await interaction.editReply(`Something went wrong: ${e}`);
                return;
            }


            
        }

        return false;
    } catch (e) {
        console.error(e);       
        await interaction.editReply('An error has occured')
        return false;
    }
}

export async function funkyClear(interaction, queueMap) {
    try {
        let queue = await getQueue(interaction, queueMap);

        if (queue) {
            queue.player.stop()
            queue.playing = false;
            queue.songs = []
            await interaction.reply('Queue has been cleared')
            return true;
        }

        return false;
    } catch (e) {
        console.error(e);       
        await interaction.reply('An error has occured')
        return false;
    }
}