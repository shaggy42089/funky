export async function fetchQueue(interaction, queueMap, callback) {
    let queue = queueMap.get(interaction.guildId);

    if (queue) {
        await callback(queue);
    } else {
        await interaction.reply('I am not currently in a voice channel')
    }

    return false;
}