"""Serve the exact HTTPS origin/assets used by Android, with every network call intercepted.
This tests web behavior, not Android WebView itself.
"""
from pathlib import Path
import mimetypes,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'app/src/main/assets'
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 context=browser.new_context(viewport={'width':360,'height':740},is_mobile=True,has_touch=True)
 denied=[]
 def route_handler(route):
  url=route.request.url
  prefix='https://mishi.local/'
  if not url.startswith(prefix):
   denied.append(url);route.abort();return
  relative=url[len(prefix):].split('?')[0] or 'index.html'
  file=(ASSETS/relative).resolve()
  if not file.is_relative_to(ASSETS.resolve()) or not file.is_file():
   route.fulfill(status=404,body='');return
  mime=mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
  if file.suffix=='.js':mime='application/javascript'
  route.fulfill(status=200,content_type=mime,body=file.read_bytes())
 context.route('**/*',route_handler)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:errors.append('HTTP '+str(r.status)+' '+r.url) if r.status>=400 else None)
 page.goto('https://mishi.local/index.html',wait_until='networkidle')
 assert page.locator('svg').count()>0
 assert not errors,errors
 assert not denied,denied
 page.evaluate("window.dispatchEvent(new Event('mishi-pause'))")
 page.evaluate("window.dispatchEvent(new Event('mishi-resume'))")
 assert not errors,errors
 assert page.evaluate("window.dispatchEvent(new Event('mishi-back',{cancelable:true}))") is True
 print(json.dumps({'https_offline_origin':'PASS','native_lifecycle_events':'PASS','external_requests':denied,'errors':errors}))
 browser.close()
