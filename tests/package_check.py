"""Check APK contents and ensure no sensitive or external resources shipped."""
from pathlib import Path
import zipfile,re,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
ns='{http://schemas.android.com/apk/res/android}'
manifest=ET.parse(root/'app/src/main/AndroidManifest.xml').getroot()
assert manifest.attrib['package']=='com.flavio26.mishi'
assert not manifest.findall('uses-permission')
assert manifest.find('uses-sdk').attrib[ns+'minSdkVersion']=='26'
assert manifest.find('application').attrib.get(ns+'debuggable','false')=='false'
assert manifest.find('application').attrib.get(ns+'allowBackup')=='false'
with zipfile.ZipFile(root/'dist/Mishi-1.0.0.apk') as z:
 names=z.namelist()
 for required in ['AndroidManifest.xml','classes.dex','resources.arsc','assets/index.html','assets/app.js','assets/model.js','assets/style.css']:
  assert required in names,required
 assert not any(re.search(r'\.(jks|keystore|pem|key)$',n) for n in names)
 for n in names:
  if n.startswith('assets/') and n.endswith(('.html','.js','.css')):
   s=z.read(n).decode('utf-8')
   assert not re.search(r'https?://(?!www\.w3\.org)',s),f'External URL in {n}'
   assert not re.search(r'\b(fetch\s*\(|XMLHttpRequest\s*\(|WebSocket\s*\(|sendBeacon\s*\(|EventSource\s*\()',s),f'Network API in {n}'
print('PASS: package, minSdk, no permissions, release mode, required assets, no keys or external network calls.')
