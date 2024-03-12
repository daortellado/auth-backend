const ffmpeg = require('fluent-ffmpeg');

ffmpeg.logger = console;  // Logs messages to the console

async function mergeVideos(videoLinks) {
  const outputFilename = 'merged_clips.mp4';

  for (const videoLink of videoLinks) {
    // ffprobe to get specific data before processing
    await ffmpeg(videoLink)
      .ffprobe((err, info) => {
        if (err) {
          console.error('Error analyzing video:', videoLink, err);
          // Handle individual video analysis error (optional)
          return;
        }

        // Access and log specific data
        console.log('Video Codec:', videoLink, info.format.streams[0].codec_name);
        console.error('Video Resolution:', videoLink, info.format.streams[0].width, 'x', info.format.streams[0].height);
        console.error('Video Duration:', videoLink, info.format.duration);
      });
  }

  const command = ffmpeg()
    .concat(videoLinks.map(link => ({ url: link }))) // Add each video link
    .output(outputFilename);

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
