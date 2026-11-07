"""Builds content/tajweed/tajweed.json: Tajweed rule spans on the app's own Tanzil Uthmani 1.1 text, for colouring only.
Source: cpfair/quran-tajweed (Collin Fair), commit 496f71cd191da00fa2a37ded79dbbddb033bb0ad, annotation data licensed
CC BY 4.0. Its character offsets refer to the Tanzil Uthmani text of about April 2017 (also attached to that repo); that
older text has no pause marks, puts the basmala in each surah's first ayah and has no tatweel before some marks, so each
span is carried over to our text through a character alignment, and kept only where every annotated character is the
same character in both texts. Anything that cannot be carried over exactly is dropped and counted. Machine-made
annotations, not reviewed by a qualified teacher; the app says so. The Quran text itself is never changed.
Usage (Python 3, standard library only):
  python3 scripts/build-tajweed.py <tajweed.hafs.uthmani-pause-sajdah.json> <quran-uthmani-2017.txt>"""
import sys, json, hashlib, difflib, xml.etree.ElementTree as ET
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
PINNED = {'tajweed': '151d616ad37a4cc21a80f20d5e1104c5b408375107ddd4d71247dea4c05ebf67', 'text': 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2'}
RULES = ['hamzat_wasl', 'lam_shamsiyyah', 'silent', 'madd_2', 'madd_246', 'madd_6', 'madd_munfasil', 'madd_muttasil', 'ghunnah',
         'ikhfa', 'ikhfa_shafawi', 'idghaam_ghunnah', 'idghaam_no_ghunnah', 'idghaam_shafawi', 'idghaam_mutajanisayn',
         'idghaam_mutaqaribayn', 'iqlab', 'qalqalah']
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main(tj, txt):
    assert sha(tj) == PINNED['tajweed'], 'tajweed.json is not the pinned file'
    assert sha(txt) == PINNED['text'], 'quran-uthmani-2017.txt is not the pinned file'
    old = {}
    for line in open(txt, encoding='utf-8'):
        p = line.rstrip('\n').split('|')
        if len(p) == 3 and p[0].isdigit(): old[(int(p[0]), int(p[1]))] = p[2]
    ours = {(int(s.get('index')), int(a.get('index'))): a.get('text') for s in ET.parse(ROOT / 'content/tanzil/quran-uthmani.xml').getroot().iter('sura') for a in s.iter('aya')}
    out, kept, dropped = {}, 0, 0
    for item in json.load(open(tj, encoding='utf-8')):
        k = (item['surah'], item['ayah']); a, b = old[k], ours[k]
        m = {}  # old index -> our index, only inside equal runs
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if tag == 'equal':
                for d in range(i2 - i1): m[i1 + d] = j1 + d
        spans = []
        for ann in item['annotations']:
            s, e = ann['start'], ann['end']
            idx = [m.get(i) for i in range(s, e)]
            if not idx or None in idx or idx != list(range(idx[0], idx[0] + len(idx))) or b[idx[0]:idx[-1] + 1] != a[s:e]:
                dropped += 1; continue
            spans.append([idx[0], idx[-1] + 1, RULES.index(ann['rule'])]); kept += 1
        if spans: out[f'{k[0]}:{k[1]}'] = sorted(spans)
    doc = {'source': 'cpfair/quran-tajweed@496f71cd191da00fa2a37ded79dbbddb033bb0ad', 'licence': 'CC BY 4.0', 'credit': 'Tajweed annotations by Collin Fair (cpfair/quran-tajweed), CC BY 4.0',
           'text': 'Tanzil Uthmani 1.1 (content/tanzil/quran-uthmani.xml)', 'reviewed': False, 'rules': RULES, 'kept': kept, 'dropped': dropped, 'spans': out}
    (ROOT / 'content/tajweed/tajweed.json').write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('kept', kept, 'dropped', dropped, 'ayahs', len(out))
if __name__ == '__main__': main(*sys.argv[1:3])
