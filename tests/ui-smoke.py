"""Offline browser integration tests for the actual single-file build.

This environment blocks browser navigation and microphone capture by policy.
No policy is changed: set_content renders the local build in about:blank.
The app's explicitly labelled temporary-storage fallback is therefore exercised.
Audio capture is tested with a generated Web Audio stream, NOT a real microphone.
Native plugins, durable browser storage, and external audio need device testing.
"""
from pathlib import Path
import json, time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT/'AyahFlow-preview.html').read_text()
OUT = ROOT/'evidence'
OUT.mkdir(exist_ok=True)
checks=[]
def ok(name):
    checks.append({'name':name,'passed':True})
    print('PASS',name,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':430,'height':932},device_scale_factor=2,timezone_id='America/New_York')
    errors=[]
    remote=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content(HTML,wait_until='load')
    page.locator('[data-action="daily"]').wait_for()
    def click(selector):
        page.locator(selector).first.click()
        page.wait_for_timeout(60)
    def nav(view): click(f'[data-action="nav"][data-view="{view}"]')
    def state():
        return page.evaluate("""async()=>{const m=JSON.parse(document.querySelector('[type=importmap]').textContent).imports;return (await import(m['ayahflow/storage'])).loadState();}""")
    def question():
        return page.evaluate("""async()=>{const m=JSON.parse(document.querySelector('[type=importmap]').textContent).imports;const s=await (await import(m['ayahflow/storage'])).loadState();const e=await import(m['ayahflow/engine']);return e.questionFor(s.session.queue[s.session.index],s.session.seed+s.session.index*107);}""")
    assert state()['xp']==0
    assert page.locator('.temporary-banner').is_visible()
    assert not remote
    ok('Real build loads offline with honest zero progress and temporary-storage notice')
    page.screenshot(animations='disabled',path=str(OUT/'01-today.png'))

    nav('quran')
    assert page.locator('.surah-row').count()==8
    page.locator('#surah-search').fill('Ikhlas')
    assert page.locator('.surah-row').count()==1
    click('[data-action="read-surah"][data-surah="112"]')
    assert page.locator('.ayah-card').count()==4
    click('[data-action="bookmark"][data-ayah="2"]')
    assert '112:2' in state()['bookmarks']
    click('[data-action="play-verse"]')
    assert not remote
    ok('Quran reader, search, bookmarks and recitation consent gate work')

    nav('practice')
    # Choose the short time guide through settings; existing memory remains.
    nav('today');nav('settings')
    click('[data-action="goal"][data-goal="3"]')
    click('[data-action="back"]')
    click('[data-action="daily"]')
    assert len(state()['session']['queue'])==5
    first_id=state()['session']['id']
    click('[data-action="pause"]')
    click('[data-action="resume"]')
    assert state()['session']['id']==first_id
    ok('Adaptive session starts at the selected length and resumes without replacement')
    for index in range(5):
        q=question()
        if q['item']['mode']=='recall':
            assert page.locator('.hidden-card').count()==1
            click('[data-action="reveal"]')
            click('[data-action="self-answer"][data-correct="'+('false' if index==0 else 'true')+'"]')
        else:
            answer=next(x for x in q['options'] if (x['id']!=q['correctId'] if index==0 else x['id']==q['correctId']))
            click(f'[data-action="select-option"][data-id="{answer["id"]}"]')
            click('[data-action="check"]')
        assert state()['session']['answered']
        assert len(state()['attempts'])==index+1
        click('[data-action="next-question"]')
    assert state()['session'] is None
    assert state()['completedSessions']==1
    assert state()['xp']==42  # one missed check (2) and four successful checks (40)
    ok('Five-question session updates real evidence, schedules misses and completes')

    nav('progress')
    assert page.locator('[data-action="practice-weak"]').count()==1
    assert 'Not available in this version' in page.locator('body').inner_text()
    page.screenshot(animations='disabled',path=str(OUT/'05-progress.png'))
    ok('Progress shows actual session results, one missed-card drill and no Tajweed score')

    nav('practice')
    click('[data-action="start-mode"][data-mode="next"]')
    assert page.locator('.option').count()==4
    page.screenshot(animations='disabled',path=str(OUT/'02-recall.png'))
    click('[data-action="pause"]')
    click('[data-action="nav"][data-view="tajweed"]')
    assert page.locator('.lesson-card').count()==4
    click('[data-action="open-lesson"][data-id="ikhfa"]')
    assert page.locator('mark').count()==1
    page.screenshot(animations='disabled',path=str(OUT/'03-tajweed.png'))
    click('[data-action="lesson-answer"][data-choice="0"]')
    assert 'ikhfa' in state()['lessonChecks']
    assert len(state()['attempts'])==5
    ok('Tajweed lesson highlight and rule quiz remain separate from recitation evidence')

    click('[data-action="record-ayah"]')
    assert 'No automatic Tajweed score' in page.locator('body').inner_text()
    page.screenshot(animations='disabled',path=str(OUT/'04-recitation.png'))
    ok('Recitation screen explicitly distinguishes comparison from pronunciation assessment')
    # Test a generated stream instead of requesting forbidden microphone capture.
    simulated=page.evaluate("""()=>{
      if(!window.AudioContext||!window.MediaRecorder)return false;
      const ctx=new AudioContext(); const source=ctx.createOscillator();
      const dest=ctx.createMediaStreamDestination();source.connect(dest);source.start();
      window.__testStream=dest.stream;window.__testAudioContext=ctx;
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{await ctx.resume();return dest.stream;}}});
      return true;
    }""")
    assert simulated
    click('[data-action="record"]')
    page.wait_for_timeout(1200)
    assert page.locator('.record-button.live').count()==1
    click('[data-action="record"]')
    page.locator('[data-action="save-recording"]').wait_for()
    assert page.evaluate('window.__testStream.getTracks().every(t=>t.readyState==="ended")')
    click('[data-action="save-recording"]')
    assert page.locator('[data-action="share-recording"]').count()==1
    clips=page.evaluate("""async()=>{const m=JSON.parse(document.querySelector('[type=importmap]').textContent).imports;return (await (await import(m['ayahflow/storage'])).listRecordings()).map(c=>({id:c.id,size:c.blob.size,duration:c.duration}));}""")
    assert clips[0]['size']>0 and clips[0]['duration']>=1
    click('[data-action="delete-recording"]')
    page.locator('#dialog-cancel').click()
    assert page.locator('[data-action="share-recording"]').count()==1
    click('[data-action="delete-recording"]')
    page.locator('#dialog-confirm').click()
    page.wait_for_timeout(100)
    assert page.locator('[data-action="share-recording"]').count()==0
    page.evaluate('window.__testAudioContext.close()')
    ok('Generated audio records to a real MediaRecorder Blob, saves temporarily, and deletes only after confirmation')

    nav('today');nav('settings')
    click('[data-action="language"][data-locale="fr"]')
    assert page.locator('html').get_attribute('lang')=='fr'
    assert 'Réglages' in page.locator('body').inner_text()
    page.locator('#motion-toggle').check()
    assert state()['reducedMotion']
    click('[data-action="language"][data-locale="ar"]')
    assert page.locator('html').get_attribute('dir')=='rtl'
    click('[data-action="back"]')
    page.screenshot(animations='disabled',path=str(OUT/'06-arabic.png'))
    ok('French translation, Arabic RTL and reduced-motion settings apply immediately')
    for width,height in [(320,740),(390,844),(412,915),(430,932),(1024,768)]:
        page.set_viewport_size({'width':width,'height':height})
        for view in ['today','practice','quran','progress']:
            nav(view)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'overflow {view} {width}'
    ok('Four main screens have no horizontal overflow across 320, 390, 412, 430 and 1024 pixel viewports')
    assert not errors,errors
    assert not remote,remote
    ok('No uncaught JavaScript errors or external requests during consent-disabled test flow')
    browser.close()

report={'build':'0.1.0','checks':checks,'passed':len(checks),'failed':0,'method':'Actual single-file build, Chromium set_content, temporary-storage mode. Microphone replaced by a generated Web Audio stream; not a real microphone test.','not_tested':['Native iOS/Android compile and hardware','Preferences / Filesystem / OS notifications / native sharing','Durable browser localStorage and IndexedDB in an ordinary origin','Real microphone permissions and interruption behavior on devices','Live external recitation provider','Signed IPA/APK or store submission']}
(OUT/'browser-tests.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'passed':len(checks),'failed':0}),flush=True)
