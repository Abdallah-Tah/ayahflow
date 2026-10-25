"""Derive the AyahFlow Quran font from Scheherazade New 4.500 (SIL OFL 1.1).
Two changes, both ccmp lookups run before any other, so Tanzil's encoding is drawn like the King Fahd Complex
(KFGQPC) digital Hafs text that Quran.com shows:
- U+0649 is drawn with the dots of U+064A where it stands for yā' (it carries a vowel/shadda/sukun, takes maddah
  first, or follows a kasra): نَجِّنِي, while alif maqsura (هُدًى, عَلَىٰ) stays dotless;
- the sukun U+0652 is drawn with the font's own U+06E1 glyph, the open "jazm" shape (يَعۡمَلُونَ);
- shadda with kasra/kasratan is not merged into one mark above the letter: the kasra stays below (رَبِّ, not a
  stroke under the shadda that reads like a fatha).
The text is never changed. Renamed because "Scheherazade" is a Reserved Font Name.
Usage (fontTools 4.55.3): python3 scripts/build-quran-font.py content/fonts/ScheherazadeNew-Regular.ttf public/fonts/AyahFlowQuran-Regular.ttf
then copy the output to ios/App/AyahFlowWidget/. Deterministic: the same input gives the same bytes."""
import sys, copy
from fontTools.ttLib import TTFont
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
src, out = sys.argv[1], sys.argv[2]
f = TTFont(src, recalcTimestamp=False)
gdef = f['GDEF'].table.GlyphClassDef.classDefs
marks = sorted(g for g, c in gdef.items() if c == 3)
skip = ' '.join(marks + ['uni0640'])
harakat = 'uni064B uni064C uni064D uni064E uni064F uni0650 uni0651 uni0652 uni06E1'
rules = ['sub uni0649\' lookup AM_YEH uni0653;']
for n in range(3):
    rules.append('sub uni0649\' lookup AM_YEH ' + '@SKIP ' * n + '@HARAKA;')
for n in range(9):
    rules.append('sub uni0650 ' + '@SKIP ' * n + 'uni0649\' lookup AM_YEH;')
fea = f"""languagesystem DFLT dflt;
languagesystem arab dflt;
@SKIP = [{skip}];
@HARAKA = [{harakat}];
lookup AM_YEH {{ sub uni0649 by uni064A; }} AM_YEH;
lookup AM_CTX {{
  {chr(10).join(rules)}
}} AM_CTX;
lookup SUKUN_JAZM {{ sub uni0652 by uni06E1; }} SUKUN_JAZM;
feature ccmp {{ lookup AM_CTX; lookup SUKUN_JAZM; }} ccmp;
"""
# Drop the shadda + kasra/kasratan ligatures (glyphs uni06510650, uni0651064D) so the kasra is drawn below the letter.
dropped = 0
for lk in f['GSUB'].table.LookupList.Lookup:
    for st in lk.SubTable:
        t = st.ExtSubTable if lk.LookupType == 7 else st
        ligs = getattr(t, 'ligatures', None)
        if ligs and 'uni0651' in ligs:
            keep = [l for l in ligs['uni0651'] if l.LigGlyph not in ('uni06510650', 'uni0651064D')]
            dropped += len(ligs['uni0651']) - len(keep)
            ligs['uni0651'] = keep
assert dropped == 4, dropped
tmp = TTFont(src)
del tmp['GSUB']
addOpenTypeFeaturesFromString(tmp, fea)
new = tmp['GSUB'].table.LookupList.Lookup  # [AM_YEH, AM_CTX, SUKUN_JAZM]
assert len(new) == 3
g = f['GSUB'].table
k = len(new)
def shift(lk):
    for st in lk.SubTable:
        t = st.ExtSubTable if lk.LookupType == 7 else st
        for attr in ('SubstLookupRecord', 'ChainSubstLookupRecord'):
            for r in getattr(t, attr, None) or []: r.LookupListIndex += k
        for attr in ('SubRuleSet', 'ChainSubRuleSet'):
            for rs in getattr(t, attr, None) or []:
                for r in (getattr(rs, 'SubRule', None) or getattr(rs, 'ChainSubRule', None) or []):
                    for rec in (getattr(r, 'SubstLookupRecord', None) or getattr(r, 'ChainSubstLookupRecord', None) or []): rec.LookupListIndex += k
        for attr in ('SubClassSet', 'ChainSubClassSet'):
            for cs in getattr(t, attr, None) or []:
                if cs is None: continue
                for r in (getattr(cs, 'SubClassRule', None) or getattr(cs, 'ChainSubClassRule', None) or []):
                    for rec in (getattr(r, 'SubstLookupRecord', None) or getattr(r, 'ChainSubstLookupRecord', None) or []): rec.LookupListIndex += k
for lk in g.LookupList.Lookup: shift(lk)
g.LookupList.Lookup[0:0] = new
g.LookupList.LookupCount = len(g.LookupList.Lookup)
for fr in g.FeatureList.FeatureRecord:
    fr.Feature.LookupListIndex = [i + k for i in fr.Feature.LookupListIndex]
    if fr.FeatureTag == 'ccmp':
        fr.Feature.LookupListIndex[0:0] = [1, 2]
    fr.Feature.LookupCount = len(fr.Feature.LookupListIndex)
assert any(fr.FeatureTag == 'ccmp' for fr in g.FeatureList.FeatureRecord)
# Rename (OFL: a Modified Version may not use the Reserved Font Names "Scheherazade" or "SIL").
name = f['name']
fam, ps = 'AyahFlow Quran', 'AyahFlowQuran-Regular'
desc = ('AyahFlow Quran is a Modified Version of Scheherazade New 4.500 by SIL Global, under the SIL Open Font License 1.1. '
        'Changes: U+0649 is drawn as yeh where it stands for ya; the sukun U+0652 is drawn with the U+06E1 (jazm) glyph; shadda+kasra is not ligated, so kasra stays below.')
for rec in list(name.names):
    if rec.nameID in (16, 17, 18, 21, 22): name.removeNames(nameID=rec.nameID)
for pid, eid, lid in {(r.platformID, r.platEncID, r.langID) for r in name.names}:
    for nid, val in ((1, fam), (2, 'Regular'), (3, '1.000;AyahFlow;' + ps), (4, fam), (6, ps), (10, desc)):
        name.setName(val, nid, pid, eid, lid)
for r in name.names:
    assert 'Scheherazade' not in r.toUnicode() or r.nameID in (0, 5, 7, 10, 13) or r.nameID >= 256, (r.nameID, r.toUnicode())
f.save(out)
print('ok', out)
