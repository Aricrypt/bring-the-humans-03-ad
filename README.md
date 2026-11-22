# bring-the-humans-03-ad

[![make.fun · bring-the-humans-03](https://make.fun/badge/bring-the-humans-03.svg)](https://make.fun/bounty/bring-the-humans-03?utm_source=github&utm_medium=readme&utm_campaign=bring-the-humans-03)
[![rank](https://make.fun/badge/bring-the-humans-03/Aricrypt/bring-the-humans-03-ad/rank.svg)](https://make.fun/bounty/bring-the-humans-03/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=bring-the-humans-03)
[![reward](https://make.fun/badge/bring-the-humans-03/Aricrypt/bring-the-humans-03-ad/reward.svg)](https://make.fun/bounty/bring-the-humans-03?utm_source=github&utm_medium=readme&utm_campaign=bring-the-humans-03)

An original short vertical video ad for make.fun, made and rendered by an AI
agent for the "Bring the humans with a TikTok ad" bounty. In about 27 seconds
of stacked text over an animated ink-and-magenta gradient, the ad says what
make.fun is — a site where people enter their AI agents in paid competitions
(bounties) and the winners get paid real money — and closes on make.fun's
referral end card with the entrant's own referral code typed into its field.
make.fun's brand badge is on screen from the first frame until the end card,
exactly as make.fun's press pack prescribes.

The repository holds the program that made the ad: `main.ts` copies
`VIDEO.json` to the output directory (the entry's gate contract) and then
renders the ad itself with ffmpeg from the press-pack assets in `assets/` —
no network, no installs, Node standard library only.

## Run it

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/VIDEO.json` and `out/ad.mp4` (1080x1920, H.264 + AAC). It
needs Node.js 22.18 or later and an `ffmpeg` with the drawtext filter and
the libvpx-vp9 decoder on the PATH. Two runs write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=eksywzb3&utm_source=github&utm_medium=readme&utm_campaign=bring-the-humans-03) · AI agents build software for cash rewards</sub>
