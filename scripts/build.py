"""Build offline assets into a signed APK using JDK 17 and Android SDK Build Tools 35.
No Gradle or third-party Android dependencies. See README for environment variables.
"""
from pathlib import Path
import os, subprocess, zipfile, hashlib, json, sys, shutil

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'app/src/main'
BUILD = ROOT / 'build'
DIST = ROOT / 'dist'
missing = [name for name in ('JAVA_HOME','ANDROID_BUILD_TOOLS','ANDROID_JAR','MISHI_KEYSTORE','MISHI_STORE_PASS') if not os.environ.get(name)]
if missing: sys.exit('Missing build environment variables: '+', '.join(missing))
JAVA = Path(os.environ['JAVA_HOME']) / 'bin'
TOOLS = Path(os.environ['ANDROID_BUILD_TOOLS'])
ANDROID = Path(os.environ['ANDROID_JAR'])
KEY = Path(os.environ['MISHI_KEYSTORE'])
required_assets = ['index.html', 'style.css', 'model.js', 'app.js']
if not all((SRC/'assets'/name).is_file() for name in required_assets):
    sys.exit('Missing required UI assets; refusing to build an incomplete APK.')
if not os.environ.get('MISHI_STORE_PASS') or not KEY.exists():
    sys.exit('Provide existing MISHI_KEYSTORE and MISHI_STORE_PASS. Keep your signing key private.')
for stale in [BUILD/'classes', BUILD/'dex', BUILD/'generated']:
    if stale.exists(): shutil.rmtree(stale)
for path in [BUILD, DIST, BUILD/'classes', BUILD/'dex', BUILD/'generated']:
    path.mkdir(parents=True, exist_ok=True)
def run(*args):
    subprocess.run([str(x) for x in args], check=True)
exe = '.exe' if os.name == 'nt' else ''
run(TOOLS/('aapt2'+exe), 'compile', '--dir', SRC/'res', '-o', BUILD/'resources.zip')
run(TOOLS/('aapt2'+exe), 'link', '-o', BUILD/'base.apk', '-I', ANDROID,
    '--manifest', SRC/'AndroidManifest.xml', '--java', BUILD/'generated',
    '--min-sdk-version', '26', '--target-sdk-version', '35', '-A', SRC/'assets', BUILD/'resources.zip')
sources = list((SRC/'java').rglob('*.java')) + list((BUILD/'generated').rglob('*.java'))
run(JAVA/('javac'+exe), '-encoding', 'UTF-8', '-source', '8', '-target', '8',
    '-bootclasspath', ANDROID, '-d', BUILD/'classes', *sources)
run(JAVA/('java'+exe), '-cp', TOOLS/'lib/d8.jar', 'com.android.tools.r8.D8',
    '--release', '--min-api', '26', '--lib', ANDROID, '--output', BUILD/'dex',
    *list((BUILD/'classes').rglob('*.class')))
with zipfile.ZipFile(BUILD/'base.apk', 'a', zipfile.ZIP_DEFLATED) as apk:
    for dex in (BUILD/'dex').glob('*.dex'): apk.write(dex, dex.name)
run(TOOLS/('zipalign'+exe), '-f', '4', BUILD/'base.apk', BUILD/'aligned.apk')
output = DIST/'Mishi-1.0.0.apk'
run(JAVA/('java'+exe), '-jar', TOOLS/'lib/apksigner.jar', 'sign',
    '--ks', KEY, '--ks-key-alias', 'mishi', '--ks-pass', 'env:MISHI_STORE_PASS',
    '--key-pass', 'env:MISHI_STORE_PASS', '--out', output, BUILD/'aligned.apk')
run(JAVA/('java'+exe), '-jar', TOOLS/'lib/apksigner.jar', 'verify', '--verbose', '--print-certs', output)
run(TOOLS/('zipalign'+exe), '-c', '-v', '4', output)
run(TOOLS/('aapt2'+exe), 'dump', 'badging', output)
sha = hashlib.sha256(output.read_bytes()).hexdigest()
(DIST/'SHA256SUMS.txt').write_text(f'{sha}  {output.name}\n', encoding='utf-8')
print(json.dumps({'apk':str(output),'bytes':output.stat().st_size,'sha256':sha}, indent=2))
