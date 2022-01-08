const VLC = require("vlc-client");
const {exec} = require("child_process");
const {parseSync} = require('subtitle');
const fs = require("fs");
const path = require('path');
const cliSelect = require("cli-select");

(async () => {
  const files = fs.readdirSync(process.cwd());
  const videos = files.filter(it => ['.mp4', '.mkv'].includes(path.extname(it)))
  const sub_files = files.filter(it => ['.srt'].includes(path.extname(it)))

  if (!videos.length) {
    console.log('no video file here!');
    return 0;
  }
  if (!sub_files.length) {
    console.log('no subtitle file here!');
    return 0;
  }

  console.log("Select a video file:");
  let selected_video;
  if (videos.length > 1) {
    selected_video = (await cliSelect({
      values: videos,
      valueRenderer(val, selected) {
        if (selected) {
          return '# ' + val;
        }
        return val;
      }
    })).value
  }else{
    selected_video = videos[0]
  }

  console.log("Select a subtitle file:");
  let selected_sub_file;
  if (sub_files.length > 1) {
    selected_sub_file = (await cliSelect({
      values: sub_files,
      valueRenderer(val, selected) {
        if (selected) {
          return '# ' + val;
        }
        return val;
      }
    })).value
  }else{
    selected_sub_file = sub_files[0]

  }

  const vlc = new VLC.Client({
    ip: "localhost",
    port: 8080,
    username: "", //username is optional
    password: "hi"
  });

  const cmd = `vlc -I qt --extraintf http --http-password hi`;

  exec(`${cmd} ${selected_video} ${selected_sub_file}`);
  await new Promise(r => setTimeout(r, 2000))

  const input = fs.readFileSync(selected_sub_file, 'utf8')
  const subtitles = parseSync(input).map(it => it.data);

  while (1) {
    try {
      let isPlaying = await vlc.isPlaying();
      if (!isPlaying) {
        continue;
      }
      const status = await vlc.status();
      let {position, length} = status;
      //length is in the seconds
      //position is the percentage of progress
      const current_ms = Math.floor(length * position * 1000);
      const current_sub_index = subtitles.findIndex(it => current_ms >= it.start && current_ms <= it.end + 500)
      const current_subtitle = subtitles[current_sub_index];
      const next_sub_index = subtitles.findIndex(it => it.start > current_ms)
      const next_subtitle = subtitles[next_sub_index]
      if (!current_subtitle && next_subtitle) {
        const diff = next_subtitle.start - current_ms;
        if (diff > 2000) {
          const progress = ((next_subtitle.start - 500) / 1000) * 100 / length;
          await vlc.setProgress(progress);
          console.log('seeking %', progress);
          await new Promise(r => setTimeout(r, 1000))
        }
      }
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error(e);
      return 0;
    }
  }
})()
