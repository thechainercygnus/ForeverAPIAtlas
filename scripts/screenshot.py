"""Retake the README's screenshot of the symbol explorer (#45).

Serves dist/ locally, opens one symbol with captured calls, and writes a 2x WebP to
screenshots/symbol-explorer.webp, outside dist/ so the site doesn't ship it. Nothing is
installed into the repo; uv fetches Playwright for the run:

    uv run --with playwright==1.64.1 python scripts/screenshot.py

First time only: uv run --with playwright==1.64.1 playwright install chromium

Retake it after a visible change to the explorer, and in DurishLabsPortfolio, which copies it.
"""
import base64
import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUT = ROOT / 'screenshots' / 'symbol-explorer.webp'

# Five captured calls, with numbers but no names: a fair picture of the evidence.
SYMBOL = '_G.UnitStat'
VIEWPORT = {'width': 1440, 'height': 1000}
# The results list and the detail pane, cropped to the planner's screenshot shape (2400x1520),
# which the portfolio's project cards are laid out for.
ASPECT = 1520 / 2400
QUALITY = 0.82

# Start the list one row above the open symbol, so no row is cut off at the top.
ALIGN_LIST = """() => {
  const list = document.querySelector('#results');
  const rows = [...list.querySelectorAll('.row')];
  const open = rows.findIndex((row) => row.getAttribute('aria-current') === 'true');
  list.scrollTop = rows[Math.max(open - 1, 0)].offsetTop - rows[0].offsetTop;
}"""

# Encoded as WebP in the browser itself (a canvas), so no image library is needed.
TO_WEBP = """async ({data, quality}) => {
  const image = new Image();
  image.src = `data:image/png;base64,${data}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas.toDataURL('image/webp', quality).split(',')[1];
}"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def main():
    handler = functools.partial(QuietHandler, directory=str(DIST))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/#view=explorer&symbol={SYMBOL}'
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport=VIEWPORT, device_scale_factor=2, color_scheme='dark')
            page.goto(url)
            page.locator('#detail .calls li').first.wait_for()
            page.evaluate(ALIGN_LIST)
            browser_pane = page.locator('.browser:has(#detail)')
            browser_pane.evaluate("el => el.scrollIntoView({block: 'start'})")
            box = browser_pane.bounding_box()
            clip = {'x': box['x'], 'y': box['y'], 'width': box['width'], 'height': round(box['width'] * ASPECT)}
            png = page.screenshot(type='png', clip=clip)
            webp = page.evaluate(TO_WEBP, {'data': base64.b64encode(png).decode(), 'quality': QUALITY})
            browser.close()
    finally:
        server.shutdown()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_bytes(base64.b64decode(webp))
    print(f'Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
