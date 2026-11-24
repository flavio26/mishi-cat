"""Behaviour smoke test: the cat walks, reacts to care and respects reduced motion.
Run with the local preview listening on 127.0.0.1:8787.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build/test-results'; OUT.mkdir(parents=True,exist_ok=True)
def left(page): return page.evaluate("parseFloat(getComputedStyle(document.getElementById('cat')).left)")
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_context(viewport={'width':360,'height':780},is_mobile=True,has_touch=True).new_page()
 errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8787',wait_until='networkidle')
 page.evaluate("localStorage.clear()"); page.reload(wait_until='networkidle')
 room=page.locator('#room').bounding_box(); start=left(page)
 page.mouse.click(room['x']+room['width']*0.15, room['y']+room['height']*0.985)
 page.wait_for_timeout(250)
 assert 'is-walking' in page.get_attribute('#cat','class'), 'Cat does not start walking when floor tapped'
 page.wait_for_timeout(150)
 assert page.get_attribute('#cat','data-pose') in ('walk','trot','run'), page.get_attribute('#cat','data-pose')
 page.screenshot(path=str(OUT/'mishi-walking.png'))
 page.wait_for_timeout(3500)
 after_call=left(page); assert after_call < start-20, (start,after_call)
 assert page.get_attribute('#cat','data-facing')=='left', 'Cat should face left when walking left'
 page.locator('#pet').click(); page.wait_for_timeout(200)
 assert 'is-purring' in page.get_attribute('#cat','class'); assert page.locator('#fx .fx-heart').count()>0, 'No hearts when petted'
 page.evaluate("(()=>{const k='mishi.v1';const s=JSON.parse(localStorage.getItem(k));s.stats.hunger=30;localStorage.setItem(k,JSON.stringify(s));})()")
 page.reload(wait_until='networkidle'); page.wait_for_timeout(300)
 before_feed=left(page); page.locator('#feed').click(); page.wait_for_timeout(3200)
 assert left(page) > before_feed+10, 'Cat did not go to the bowl'
 assert 'is-eating' in page.get_attribute('#cat','class') or 'is-licking' in page.get_attribute('#cat','class'), 'Cat is not eating'
 assert page.get_attribute('#cat','data-pose') in ('eat','sit'), page.get_attribute('#cat','data-pose')
 page.screenshot(path=str(OUT/'mishi-eating.png'))
 page.locator('#clean').click(); page.wait_for_timeout(150)
 page.locator('#sleep').click(); page.wait_for_timeout(200)
 assert page.get_attribute('#cat','class').count('is-sleeping')==0, 'Should walk to rug before sleeping'
 page.wait_for_timeout(4500)
 assert 'is-sleeping' in page.get_attribute('#cat','class'), 'Cat did not fall asleep on rug'
 page.wait_for_timeout(200); assert page.get_attribute('#cat','data-pose')=='sleep', page.get_attribute('#cat','data-pose')
 page.screenshot(path=str(OUT/'mishi-sleeping.png'))
 page.locator('#sleep').click(); page.wait_for_timeout(300)
 page.locator('#customize summary').click(); page.locator('#reduce-motion').check(); page.locator('#customize summary').click()
 page.mouse.click(room['x']+room['width']*0.85, room['y']+room['height']*0.9); page.wait_for_timeout(100)
 assert 'is-walking' not in page.get_attribute('#cat','class'), 'Reduced motion should move without walk animation'
 for w,h in [(320,600),(390,844),(844,390)]:
  page.set_viewport_size({'width':w,'height':h}); page.wait_for_timeout(150)
  c=page.locator('#cat').bounding_box(); r=page.locator('#room').bounding_box()
  m=c['width']*0.16+2; assert c['x']>=r['x']-m and c['x']+c['width']<=r['x']+r['width']+m, f'Cat outside room at {w}x{h}'
 assert not errors, errors
 print(json.dumps({'behavior':'PASS','errors':errors}))
 browser.close()
