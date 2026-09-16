#!/usr/bin/env python3
"""Composicion del tramo de la app: capas PNG (layers/) -> app-seg.mp4 (7,2 s, 30 fps, 4356x2160)."""
import subprocess
D = 7.2; SC = 2.4; FPS = 30
inputs = ["-loop", "1", "-framerate", str(FPS), "-t", str(D), "-i", "layers/bg.png"]
layers = []
e = lambda t0, d: f"pow(1-clip((t-{t0:.3f})/{d},0,1),3)"
for i in range(1, 4):
    T0 = (i-1)*SC; T1 = T0 + SC; fo_st = T1 - 0.28; fo_d = 0.28
    layers.append((f"layers/s{i}-title.png", T0, T1, T0, 0.35, "0", f"46*{e(T0,0.55)}", fo_st, fo_d))
    layers.append((f"layers/s{i}-phone.png", T0, T1, T0, 0.25, f"W*{e(T0,0.75)}", f"16*sin(2*PI*(t-{T0:.3f})/2.4)", fo_st, fo_d))
    for k in range(1, 4):
        d0 = T0 + 0.5 + 0.2*(k-1)
        layers.append((f"layers/s{i}-chip{k}.png", T0, T1, d0, 0.3, f"-160*{e(d0,0.5)}", "0", fo_st, fo_d))
fc = []; prev = "[0:v]"
for n, (f, T0, T1, fi_st, fi_d, xe, ye, fo_st, fo_d) in enumerate(layers, 1):
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", str(D), "-i", f]
    fc.append(f"[{n}:v]format=rgba,fade=t=in:st={fi_st:.3f}:d={fi_d}:alpha=1,fade=t=out:st={fo_st:.3f}:d={fo_d}:alpha=1[l{n}]")
    fc.append(f"{prev}[l{n}]overlay=x='{xe}':y='{ye}':enable='between(t,{T0:.3f},{T1:.3f})':format=auto[b{n}]")
    prev = f"[b{n}]"
fc.append(f"{prev}format=yuv420p[v]")
cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[v]", "-r", str(FPS), "-t", str(D), "-c:v", "libx264", "-crf", "18", "-preset", "medium", "app-seg.mp4"]
r = subprocess.run(cmd, capture_output=True, text=True); print(r.stderr[-600:] or "compose ok")
