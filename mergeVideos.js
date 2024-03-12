const ffmpeg = require('fluent-ffmpeg');

async function mergeVideos(videoLinks) {
  const outputFilename = 'merged_clips.mp4';

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
