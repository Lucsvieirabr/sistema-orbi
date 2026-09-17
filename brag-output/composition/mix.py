"""Mix music bed + SFX onto brag-silent.mp4 -> ../brag-audio.mp4"""
import subprocess
DUR = 21.5
MUSIC = ("assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3", 0.32)
SFX = [  # (file, start, volume)
    ("assets/sfx/impact/impactSoft_medium_001.ogg", 0.58, 0.70),   # hook headline lands
    *[("assets/sfx/ui/click2.ogg", t, 0.42) for t in (7.64, 8.19, 8.74, 9.29, 9.83)],  # rows classify (beat-grid)
    ("assets/sfx/interface/bong_001.ogg", 9.95, 0.60),             # Categorizado
    ("assets/sfx/impact/impactSoft_medium_004.ogg", 15.27, 0.78),  # Ruptura prevista alert
    ("assets/sfx/impact/impactBell_heavy_000.ogg", 17.42, 0.55),   # Orbi mark (beat-locked 17.47)
]
inputs = ["-i", "../brag-silent.mp4", "-i", MUSIC[0]] + sum([["-i", f] for f, _, _ in SFX], [])
fc = [f"[1:a]atrim=0:{DUR},asetpts=PTS-STARTPTS,volume={MUSIC[1]},afade=t=in:st=0:d=0.6,afade=t=out:st={DUR-1.2}:d=1.2[m]"]
labels = ["[m]"]
for i, (_, st, v) in enumerate(SFX):
    ms = int(st * 1000)
    fc.append(f"[{i+2}:a]aresample=48000,volume={v},adelay={ms}|{ms}[s{i}]")
    labels.append(f"[s{i}]")
fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,atrim=0:{DUR}[a]")
cmd = ["ffmpeg", "-y", "-v", "error"] + inputs + ["-filter_complex", ";".join(fc), "-map", "0:v", "-map", "[a]",
       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(DUR), "-movflags", "+faststart", "../brag-audio.mp4"]
subprocess.run(cmd, check=True)
print("ok")
