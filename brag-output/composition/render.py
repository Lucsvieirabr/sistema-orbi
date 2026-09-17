"""Frame-accurate renderer for index.html (Hyperframes fallback).
Usage: python3 render.py frames <t1> <t2> ...   -> PNG stills in ../stills/
       python3 render.py video                   -> ../brag-silent.mp4
"""
import sys, subprocess, pathlib, asyncio
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent
FPS = 30

async def main():
    mode = sys.argv[1]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=None, args=["--allow-file-access-from-files", "--font-render-hinting=none"])
        pg = await b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
        await pg.goto((HERE / "index.html").as_uri())
        await pg.evaluate("window.__ready")
        await pg.wait_for_timeout(300)
        if mode == "frames":
            (OUT / "stills").mkdir(exist_ok=True)
            for t in sys.argv[2:]:
                await pg.evaluate(f"window.render({float(t)})")
                await pg.screenshot(path=str(OUT / "stills" / f"t{float(t):05.2f}.png"))
        else:
            dur = await pg.evaluate("window.DURATION")
            n = round(dur * FPS)
            ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                   "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                                   str(OUT / "brag-silent.mp4")], stdin=subprocess.PIPE)
            for i in range(n):
                await pg.evaluate(f"window.render({i / FPS})")
                ff.stdin.write(await pg.screenshot(type="jpeg", quality=95))
                if i % 60 == 0: print("frame", i, "/", n, flush=True)
            ff.stdin.close(); ff.wait()
        if errs: print("PAGE ERRORS:", errs)
        await b.close()

asyncio.run(main())
