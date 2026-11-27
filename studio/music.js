'use strict';
// Detect amplitude onsets from decoded PCM. Report times in seconds to follow the audio clock.
function detectOnsets(buffer) {
    const hop = Math.max(1, Math.round(buffer.sampleRate * 0.02));
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0);
    const times = [];
    let baseline = 0, previous = 0, last = -1;
    for (let start = 0; start < left.length; start += hop) {
        let sum = 0;
        const end = Math.min(start + hop, left.length);
        for (let i = start; i < end; i++) sum += left[i]*left[i] + right[i]*right[i];
        const energy = Math.sqrt(sum / (2 * (end - start)));
        const time = start / buffer.sampleRate;
        if (energy > 0.016 && energy > baseline * 1.35 && energy - previous > 0.008 && time-last >= 0.19) {
            times.push(time);
            last = time;
        }
        baseline = 0.91 * baseline + 0.09 * energy;
        previous = energy;
    }
    return times;
}
if (typeof module !== 'undefined') module.exports = {detectOnsets};
