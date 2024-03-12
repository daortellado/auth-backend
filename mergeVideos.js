const ffmpeg = require('fluent-ffmpeg');

ffmpeg.logger = console;  // Logs messages to the console

async function mergeVideos(videoLinks) {
  const outputFilename = 'merged_clips.mp4';

  // Process each video link individually
  for (const videoLink of videoLinks) {
    console.log('Processing video:', videoLink);

    // ffprobe to get specific data before processing
    await ffmpeg(videoLink)
      .ffprobe((err, info) => {
        if (err) {
          console.error('Error analyzing video:', videoLink, err);
          // Optional: Handle the error (e.g., log or skip silently)
        } else {
          // Access and log specific data
          console.log('Video Codec:', videoLink, info.format.streams[0].codec_name);
          console.error('Video Resolution:', videoLink, info.format.streams[0].width, 'x', info.format.streams[0].height);
          console.error('Video Duration:', videoLink, info.format.duration);
        }
      });
  }

  // Assuming the first video link is the "first part"
  const firstVideo = videoLinks[0];

  const command = ffmpeg()
    .input(firstVideo) // Use the first video as input
    .output(outputFilename);

  // Optionally add the remaining videos using concat
  for (let i = 1; i < videoLinks.length; i++) {
    command.concat(videoLinks[i]);
  }

  try {
    await command.on('end', () => console.log('Videos merged successfully!'))
      .on('error', (err) => console.error('Error merging videos:', err))
      .run();

    return outputFilename; // Return the output filename
  } catch (error) {
    console.error('Error merging videos:', error);
    return null; // Indicate failure
  }
}

module.exports = mergeVideos; // Export the function for use in other files
