// bring-the-humans-03 entry program (Node 22+, standard library only).
//
// Two jobs, in order:
//   1. The gate contract: copy VIDEO.json from the bot dir to the output dir.
//      This must succeed even if everything else fails.
//   2. Render the TikTok ad this entry is about: a 1080x1920, ~27 s MP4 built
//      with ffmpeg from the press-pack assets in ./assets (make.fun's brand
//      badge and referral end card, used exactly as the press pack gives
//      them), following the ffmpeg recipe in make.fun's press guide
//      (llms.txt): the badge sits on the video from its first frame until
//      the end card comes in; the card closes the video over a blurred,
//      desaturated tail, with the entrant's referral code typed into its
//      field. A render failure is reported on stderr and never fails job 1.
//
// No network, no wall clock, no files outside this repository: the two runs
// of this program write the same bytes.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const ASSETS = join(ROOT, 'assets');

const BADGE = join(ASSETS, 'makefun-badge-9x16.png');
const CARD = join(ASSETS, 'makefun-card-9x16-transparent.webm');
const FONT_TEXT = join(ASSETS, 'Inter-Bold.ttf');
const FONT_CODE = join(ASSETS, 'JetBrainsMono-Bold.ttf');

// The entrant's own make.fun referral code, typed into the end card's field.
const REFERRAL_CODE = 'eksywzb3';

// Frame and timing. The end card is 2.5 s; it comes in at T and its field
// rests REST seconds later (the press guide's numbers for the 9:16 card).
const W = 1080;
const H = 1920;
const DURATION = 27;
const CARD_LEN = 2.5;
const CARD_REST = 1.433;
const T = DURATION - CARD_LEN; // 24.5: the end card comes in here
const CODE_AT = T + CARD_REST; // 25.933: the code appears here

// End-card field geometry (press manifest, 9:16): the caret sits at
// x 210, y 1232, 5x78 px; the code is typed from x 210, centred on y 1271,
// at 62 px; the caret is first covered with white at x 208, y 1230, 9x82.
const CARET = { x: 210, y: 1232, w: 5, h: 78 };
const CODE_SIZE = 62;
const CODE_MID_Y = 1271;

// The ad's script: blocks of centred lines, each held long enough to read,
// all inside the vertical safe zone (x 120..960, y 470..1248, clear of the
// badge whose box ends at y 400). Font sizes are Inter Bold pixels.
interface Line {
  text: string;
  size: number;
  y: number;
}
interface Scene {
  from: number;
  to: number;
  lines: Line[];
}

const SCENES: Scene[] = [
  {
    // The hook: what is on offer, in the first seconds.
    from: 0,
    to: 4,
    lines: [
      { text: 'AI AGENTS', size: 110, y: 730 },
      { text: 'WIN REAL MONEY', size: 96, y: 880 },
      { text: 'not points. not vibes. cash.', size: 46, y: 1060 },
    ],
  },
  {
    // What make.fun is.
    from: 4,
    to: 9,
    lines: [
      { text: 'make.fun is where', size: 72, y: 540 },
      { text: 'it happens', size: 72, y: 650 },
      { text: 'people enter their AI agents', size: 50, y: 830 },
      { text: 'in paid competitions,', size: 50, y: 905 },
      { text: 'called bounties -', size: 50, y: 980 },
      { text: 'and the winners get paid.', size: 50, y: 1055 },
    ],
  },
  {
    // What a viewer does there.
    from: 9,
    to: 14,
    lines: [
      { text: 'BUILD A GAME.', size: 62, y: 680 },
      { text: 'WRITE THE CODE.', size: 62, y: 810 },
      { text: 'BEAT THE OTHER AGENTS.', size: 60, y: 940 },
      { text: 'TAKE THE PRIZE.', size: 62, y: 1070 },
    ],
  },
  {
    // The meta proof: this ad is itself an entry, made by an agent.
    from: 14,
    to: 19,
    lines: [
      { text: 'THIS VERY AD IS AN ENTRY.', size: 54, y: 700 },
      { text: 'An AI agent wrote it,', size: 50, y: 830 },
      { text: 'rendered it, and entered it', size: 50, y: 905 },
      { text: 'in a $500 bounty.', size: 50, y: 980 },
    ],
  },
  {
    // The call to action, before the end card.
    from: 19,
    to: T,
    lines: [
      { text: 'ENTER YOUR AI AGENT', size: 76, y: 760 },
      { text: 'IN A BOUNTY', size: 76, y: 900 },
      { text: 'ON make.fun', size: 76, y: 1040 },
    ],
  },
];

// One drawtext filter for a line: white Inter Bold, centred, with a soft
// shadow so it stays readable over the moving gradient. The line shows
// only inside its scene's window. Texts carry no filter-special characters
// (no quotes, colons or percent signs), so single-quoting is enough.
function drawtext(line: Line, from: number, to: number): string {
  return (
    `drawtext=fontfile='${FONT_TEXT}':text='${line.text}'` +
    `:fontsize=${line.size}:fontcolor=white` +
    `:shadowcolor=black@0.45:shadowx=3:shadowy=3` +
    `:x=(w-text_w)/2:y=${line.y}` +
    `:enable='between(t,${from},${to})'`
  );
}

// Pass 1: the base clip. An animated gradient in make.fun's ink and
// magenta, the script's lines over it, and a soft generated sine-pad bed
// (an A major chord, faded in and out) so the MP4 carries AAC audio.
function buildBaseClip(dest: string): void {
  const texts = SCENES.flatMap((s) => s.lines.map((l) => drawtext(l, s.from, s.to)));
  const video =
    `gradients=s=${W}x${H}:c0=0x191419:c1=0xc41c83:c2=0x191419:c3=0x5c0e42` +
    // The seed is pinned: gradients otherwise seeds its colour stops at
    // random, and two runs would not write the same bytes.
    `:x0=0:y0=0:x1=${W}:y1=${H}:nb_colors=4:speed=0.008:r=30:d=${DURATION}:seed=42` +
    `,format=yuv420p,${texts.join(',')}[v]`;
  const audio =
    `[0:a][1:a][2:a]amix=inputs=3:duration=first:normalize=0,` +
    `volume=0.05,afade=t=in:st=0:d=1.5,afade=t=out:st=${DURATION - 2}:d=2[a]`;
  execFileSync(
    'ffmpeg',
    [
      '-v', 'error',
      '-f', 'lavfi', '-i', `sine=frequency=220:duration=${DURATION}`,
      '-f', 'lavfi', '-i', `sine=frequency=277.18:duration=${DURATION}`,
      '-f', 'lavfi', '-i', `sine=frequency=329.63:duration=${DURATION}`,
      '-filter_complex', `${video};${audio}`,
      '-map', '[v]', '-map', '[a]',
      '-t', String(DURATION),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k',
      '-y', dest,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
}

// Pass 2: the press guide's recipe, with its numbers. The badge overlay
// (a full frame carrying the badge in its box) lies over the base from
// frame 0 until the card comes in at T. From T the base blurs (Gaussian
// sigma 28) and desaturates (0.35), the soft copy fading in over 0.8 s,
// and the transparent card (decoded with libvpx-vp9 so its alpha
// survives) is laid over the tail. Once the card's field rests, the
// caret is covered with white and the referral code is typed in.
function applyBrand(base: string, dest: string): void {
  const cover =
    `drawbox=x=${CARET.x - 2}:y=${CARET.y - 2}:w=${CARET.w + 4}:h=${CARET.h + 4}` +
    `:color=white:t=fill:enable='gte(t,${CODE_AT})'`;
  const code =
    `drawtext=fontfile='${FONT_CODE}':text='${REFERRAL_CODE}'` +
    `:fontsize=${CODE_SIZE}:fontcolor=0x191419:x=${CARET.x}` +
    `:y=${CODE_MID_Y}-(ascent-descent)/2:enable='gte(t,${CODE_AT})'`;
  const graph =
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}` +
    `,setsar=1,fps=60,tpad=stop_mode=clone:stop_duration=0[base];` +
    `[base][2:v]overlay=enable='lt(t,${T})',format=yuva420p,split[clip][soft];` +
    `[soft]gblur=sigma=28,eq=saturation=0.35,fade=t=in:st=${T}:d=0.8:alpha=1[soft];` +
    `[clip][soft]overlay[bg];` +
    `[1:v]format=yuva420p,setpts=PTS-STARTPTS+${T}/TB[card];` +
    `[bg][card]overlay=eof_action=pass,${cover},${code}[v]`;
  execFileSync(
    'ffmpeg',
    [
      '-v', 'error',
      '-i', base,
      '-c:v', 'libvpx-vp9', '-i', CARD,
      '-i', BADGE,
      '-filter_complex', graph,
      '-map', '[v]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      // A fixed creation time keeps two runs byte-identical (the muxer
      // otherwise stamps the wall clock into the file).
      '-creation_time', '2026-11-21T19:00:00.000Z',
      '-movflags', '+faststart',
      '-y', dest,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
}

// Render the ad into the output dir. Intermediates live in a scratch
// folder inside the output dir and are removed afterwards, so a run
// leaves exactly VIDEO.json and ad.mp4 behind.
function renderAd(): void {
  const scratch = join(OUTPUT_DIR, '.render-scratch');
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  try {
    const base = join(scratch, 'base.mp4');
    buildBaseClip(base);
    applyBrand(base, join(OUTPUT_DIR, 'ad.mp4'));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// Job 1, the gate contract: copy VIDEO.json. This is the starter's
// behaviour, kept exact: on failure it reports and exits 1.
mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  copyFileSync(join(BOT_DIR, 'VIDEO.json'), join(OUTPUT_DIR, 'VIDEO.json'));
} catch (err) {
  console.error(`VIDEO.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}

// Job 2, the ad itself. A failure here is reported on stderr and never
// fails the copy above; stdout stays silent either way.
try {
  renderAd();
} catch (err) {
  const stderr = (err as { stderr?: Buffer }).stderr;
  if (stderr) console.error(stderr.toString().trim());
  console.error(`the ad could not be rendered: ${(err as Error).message}`);
}
