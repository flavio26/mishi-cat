"""Life smoke test: poop/vomit appear in the room, the cat acts it out, and cleaning removes them.
Run with the local preview listening on 127.0.0.1:8787.
"""
from pathlib import Path
import json, time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build/test-results'; OUT.mkdir(parents=True,exist_ok=True)
SET="(o)=>{const k='mishi.v1';const s=JSON.parse(localStorage.getItem(k));Object.assign(s,o.top||{});Object.assign(s.stats,o.stats||{});localStorage.setItem(k,JSON.stringify(s));}"
def patch(page,o):
 page.goto('http://127.0.0.1:8787/__blank__',wait_until='load')
 page.evaluate(SET,o)
 page.goto('http://127.0.0.1:8787/',wait_until='networkidle'); page.wait_for_timeout(300)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True).new_page()
 errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8787',wait_until='networkidle')
 page.evaluate("localStorage.clear()"); page.reload(wait_until='networkidle')
 # 1) mess made while away appears straight away
 # 0) litter box: used while away, fills, tap to clean
 patch(page,{'top':{'poopDueAt':1,'litter':1}})
 assert page.locator('#mess .mess-item').count()==0,'Poop should go to the litter box'
 assert 'litter-2' in page.get_attribute('#room','class'),page.get_attribute('#room','class')
 assert page.locator('#mess-count').inner_text()=='1','Dirty litter box should show in badge'
 page.screenshot(path=str(OUT/'mishi-litter.png'))
 page.locator('#litter-btn').click(); page.wait_for_timeout(200)
 assert 'litter-1' not in page.get_attribute('#room','class'),'Tapping litter box did not clean it'
 assert page.evaluate("JSON.parse(localStorage.getItem('mishi.v1')).litter")==0
 # 0b) live: the cat walks to the box and squats there
 patch(page,{'top':{'poopDueAt':int(time.time()*1000)+3000,'litter':0}})
 poses=set()
 for _ in range(60):
  page.wait_for_timeout(250); poses.add(page.get_attribute('#cat','data-pose'))
  if 'litter-1' in (page.get_attribute('#room','class') or ''): break
 assert 'poop' in poses and 'litter-1' in page.get_attribute('#room','class'),('Litter box not used live',poses)
 page.wait_for_timeout(2500)
 # 1) full box: mess made while away lands on the floor
 patch(page,{'top':{'poopDueAt':1,'litter':3}})
 assert page.locator('#mess .mess-poop').count()==1,'Poop made while away not shown'
 assert page.locator('#mess-count').is_visible() and page.locator('#mess-count').inner_text()=='2'
 page.screenshot(path=str(OUT/'mishi-poop.png'))
 page.locator('#mess .mess-poop').click(); page.wait_for_timeout(200)
 assert page.locator('#mess .mess-item').count()==0,'Tapping poop did not clean it'
 assert page.locator('#mess-count').inner_text()=='1'
 page.locator('#litter-btn').click(); page.wait_for_timeout(200)
 assert not page.locator('#mess-count').is_visible()
 # 2) live: overfeed -> vomit acted out, then poop later; Limpiar cleans all
 patch(page,{'stats':{'hunger':88}})
 page.locator('#feed').click()
 seen=set()
 for _ in range(110):
  page.wait_for_timeout(250); cls=page.get_attribute('#cat','class')
  for c in ['is-vomit','is-poop']:
   if c in cls: seen.add(c)
  if page.locator('#mess .mess-vomit').count(): break
 assert 'is-vomit' in seen,('Cat did not act out vomiting',seen,page.locator('#message').inner_text(),page.evaluate("localStorage.getItem('mishi.v1')")[-260:])
 assert page.locator('#mess .mess-vomit').count()==1,'Vomit did not appear'
 page.screenshot(path=str(OUT/'mishi-vomit.png'))
 patch(page,{'top':{'poopDueAt':1,'litter':3}})
 n=page.locator('#mess .mess-item').count(); assert n>=2,n
 page.locator('#clean').click(); page.wait_for_timeout(200)
 assert page.locator('#mess .mess-item').count()==0,'Limpiar did not clean the room'
 saved=page.evaluate("JSON.parse(localStorage.getItem('mishi.v1'))"); assert len(saved['mess'])==0 and saved['litter']==0,(saved['mess'],saved['litter'])
 assert not errors, errors
 print(json.dumps({'life':'PASS','seen':sorted(seen),'errors':errors}))
 browser.close()
