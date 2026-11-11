"""UI smoke test. Requires pip install playwright; uses installed Chrome.
Run with the local preview listening on 127.0.0.1:8787.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build/test-results'
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 page=context.new_page()
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 requests=[]
 page.on('request',lambda r:requests.append(r.url))
 page.goto('http://127.0.0.1:8787',wait_until='networkidle')
 page.screenshot(path=str(OUT/'mishi-mobile.png'),full_page=True)
 assert page.locator('svg').count()>0, 'Missing cat illustration'
 for required in ['cat','feed','pet','sleep','clean','play','name','coat','sound','game','game-target','game-time','game-score','game-close','stat-hunger','stat-energy','stat-mood','stat-cleanliness','level','xp','message','cat-name']:
  assert page.locator('#'+required).count()==1,'Missing #'+required
 old=page.locator('#stat-mood').inner_text()
 page.locator('#pet').click();assert page.locator('#stat-mood').inner_text()!=old
 page.locator('#play').click();assert page.locator('#game').is_visible()
 page.locator('#game-target').click();assert page.locator('#game-score').inner_text()=='1'
 page.locator('#game-close').click();assert not page.locator('#game').is_visible()
 page.locator('#customize summary').click();page.locator('#name').fill('Luna');page.locator('#name').press('Tab')
 page.reload(wait_until='networkidle');assert page.locator('#cat-name').inner_text()=='Luna'
 assert not errors,errors
 assert all(u.startswith('http://127.0.0.1:8787') or u.startswith('data:') for u in requests),requests
 for width,height in [(320,640),(360,800),(390,844),(768,1024),(844,390)]:
  page.set_viewport_size({'width':width,'height':height})
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),f'Overflow {width}x{height}'
 print(json.dumps({'errors':errors,'network_requests':requests,'buttons':page.get_by_role('button').all_text_contents()},ensure_ascii=False,indent=2))
 browser.close()
