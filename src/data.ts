/** Arabic starter corpus. Source snapshots: Quran.com, 2026-09-28.
 * Preserve the Arabic strings; ayah numbers are metadata, not part of the text.
 * Editorial cross-check != certification. See docs/CONTENT-PROVENANCE.md.
 * No generated distractor text or synthetic recitation is permitted.
 */
export interface Surah {
    id: number;
    name: string;
    ar: string;
    count: number;
    juz: number;
    firstGlobal: number;
    verses: readonly string[];
    source: string;
}
export const SURAH_DATA: readonly Surah[] = [
    { id: 1, name: 'Al-Fatihah', ar: 'الفاتحة', count: 7, juz: 1, firstGlobal: 1, source: 'https://quran.com/al-fatihah', verses: [
            'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
            'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
            'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
            'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
            'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
            'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
            'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ'
        ] },
    { id: 103, name: "Al-'Asr", ar: 'العصر', count: 3, juz: 30, firstGlobal: 6177, source: 'https://quran.com/al-asr', verses: [
            'وَٱلْعَصْرِ', 'إِنَّ ٱلْإِنسَـٰنَ لَفِى خُسْرٍ',
            'إِلَّا ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّـٰلِحَـٰتِ وَتَوَاصَوْا۟ بِٱلْحَقِّ وَتَوَاصَوْا۟ بِٱلصَّبْرِ'
        ] },
    { id: 108, name: 'Al-Kawthar', ar: 'الكوثر', count: 3, juz: 30, firstGlobal: 6205, source: 'https://quran.com/al-kawthar', verses: [
            'إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ', 'فَصَلِّ لِرَبِّكَ وَٱنْحَرْ', 'إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ'
        ] },
    { id: 109, name: 'Al-Kafirun', ar: 'الكافرون', count: 6, juz: 30, firstGlobal: 6208, source: 'https://quran.com/al-kafirun', verses: [
            'قُلْ يَـٰٓأَيُّهَا ٱلْكَـٰفِرُونَ', 'لَآ أَعْبُدُ مَا تَعْبُدُونَ', 'وَلَآ أَنتُمْ عَـٰبِدُونَ مَآ أَعْبُدُ',
            'وَلَآ أَنَا۠ عَابِدٌۭ مَّا عَبَدتُّمْ', 'وَلَآ أَنتُمْ عَـٰبِدُونَ مَآ أَعْبُدُ', 'لَكُمْ دِينُكُمْ وَلِىَ دِينِ'
        ] },
    { id: 110, name: 'An-Nasr', ar: 'النصر', count: 3, juz: 30, firstGlobal: 6214, source: 'https://quran.com/an-nasr', verses: [
            'إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ', 'وَرَأَيْتَ ٱلنَّاسَ يَدْخُلُونَ فِى دِينِ ٱللَّهِ أَفْوَاجًۭا',
            'فَسَبِّحْ بِحَمْدِ رَبِّكَ وَٱسْتَغْفِرْهُ ۚ إِنَّهُۥ كَانَ تَوَّابًۢا'
        ] },
    { id: 112, name: 'Al-Ikhlas', ar: 'الإخلاص', count: 4, juz: 30, firstGlobal: 6222, source: 'https://quran.com/al-ikhlas', verses: [
            'قُلْ هُوَ ٱللَّهُ أَحَدٌ', 'ٱللَّهُ ٱلصَّمَدُ', 'لَمْ يَلِدْ وَلَمْ يُولَدْ', 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ'
        ] },
    { id: 113, name: 'Al-Falaq', ar: 'الفلق', count: 5, juz: 30, firstGlobal: 6226, source: 'https://quran.com/al-falaq', verses: [
            'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ', 'مِن شَرِّ مَا خَلَقَ', 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
            'وَمِن شَرِّ ٱلنَّفَّـٰثَـٰتِ فِى ٱلْعُقَدِ', 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ'
        ] },
    { id: 114, name: 'An-Nas', ar: 'الناس', count: 6, juz: 30, firstGlobal: 6231, source: 'https://quran.com/an-nas', verses: [
            'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ', 'مَلِكِ ٱلنَّاسِ', 'إِلَـٰهِ ٱلنَّاسِ',
            'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ', 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ', 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ'
        ] },
];
export function chapter(id: number): Surah { const result = SURAH_DATA.find(s => s.id === id); if (!result)
    throw new Error('Unknown surah'); return result; }
export function verse(surah: number, ayah: number): string { const text = chapter(surah).verses[ayah - 1]; if (!text)
    throw new Error('Ayah outside chapter'); return text; }
export function audioUrl(surah: number, ayah: number): string { verse(surah, ayah); return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${chapter(surah).firstGlobal + ayah - 1}.mp3`; }
export type RuleId = 'ikhfa' | 'ghunnah' | 'qalqalah' | 'madd';
export interface Lesson {
    id: RuleId;
    name: string;
    ar: string;
    surah: number;
    ayah: number;
    highlight: string;
    description: {
        en: string;
        fr: string;
        ar: string;
    };
    tip: {
        en: string;
        fr: string;
        ar: string;
    };
    question: {
        en: string;
        fr: string;
        ar: string;
    };
    choices: {
        en: string[];
        fr: string[];
        ar: string[];
    };
    answer: number;
    source: string;
    reviewStatus: 'editorial-draft';
}
export const LESSONS: readonly Lesson[] = [
    { id: 'ikhfa', name: 'Ikhfa', ar: 'الإخفاء', surah: 113, ayah: 2, highlight: 'مِن شَرِّ', description: { en: 'Here, noon saakinah is followed by sheen. Conceal the noon with nasal resonance while preparing for the next letter.', fr: 'Ici, le noun sans voyelle est suivi du chin. Dissimulez le noun avec une résonance nasale en préparant la lettre suivante.', ar: 'هنا جاءت الشين بعد النون الساكنة. تُخفى النون مع الغنة استعدادًا للحرف التالي.' }, tip: { en: 'Listen to the whole phrase. Practise at the reciter’s natural pace; do not use a slowed recording to measure counts.', fr: 'Écoutez toute la phrase. Pratiquez au rythme naturel ; ne mesurez pas les temps sur un enregistrement ralenti.', ar: 'استمع إلى العبارة كاملة وتمرّن بالسرعة الطبيعية. لا تقس زمن الغنة بالتسجيل البطيء.' }, question: { en: 'Which letter follows the noon here?', fr: 'Quelle lettre suit le noun ici ?', ar: 'ما الحرف الذي يلي النون هنا؟' }, choices: { en: ['Sheen (ش)', 'Baa (ب)', 'Meem (م)'], fr: ['Chin (ش)', 'Ba (ب)', 'Mim (م)'], ar: ['الشين', 'الباء', 'الميم'] }, answer: 0, source: 'https://alquran.cloud/tajweed-guide', reviewStatus: 'editorial-draft' },
    { id: 'ghunnah', name: 'Ghunnah', ar: 'الغنة', surah: 114, ayah: 6, highlight: 'ٱلْجِنَّةِ', description: { en: 'The noon with shaddah carries a nasal sound. Listen for the ghunnah, conventionally taught as two counts at the recitation’s pace.', fr: 'Le noun avec chadda porte un son nasal. Écoutez la ghounna, enseignée sur deux temps au rythme de la récitation.', ar: 'النون المشددة فيها غنة تُعلَّم بمقدار حركتين بحسب سرعة القراءة.' }, tip: { en: 'Two counts are relative to the recitation, not two seconds. A qualified teacher can check your sound.', fr: 'Deux temps ne signifient pas deux secondes. Un enseignant qualifié peut vérifier votre son.', ar: 'الحركتان ليستا ثانيتين ثابتتين. اعرض صوتك على معلّم متقن.' }, question: { en: 'Which mark is on the noon?', fr: 'Quel signe porte le noun ?', ar: 'ما العلامة على النون؟' }, choices: { en: ['Shaddah', 'Sukoon', 'No mark'], fr: ['Chadda', 'Soukoun', 'Aucun signe'], ar: ['شدة', 'سكون', 'لا علامة'] }, answer: 0, source: 'https://alquran.cloud/tajweed-guide', reviewStatus: 'editorial-draft' },
    { id: 'qalqalah', name: 'Qalqalah', ar: 'القلقلة', surah: 112, ayah: 1, highlight: 'أَحَدٌ', description: { en: 'When stopping at the end of this ayah, the daal becomes saakin. Give it a controlled release, without adding an extra vowel.', fr: 'À l’arrêt en fin de cette aya, le dal devient sans voyelle. Relâchez le son sans ajouter de voyelle.', ar: 'عند الوقف على نهاية الآية تسكن الدال. اقلقلها دون إضافة حركة.' }, tip: { en: 'This example is specifically for stopping. The instruction is not a general rule for continuing into the next ayah.', fr: 'Cet exemple concerne l’arrêt, et non la liaison avec l’aya suivante.', ar: 'هذا المثال خاص بالوقف، وليس حكمًا عامًا عند وصل الآية بما بعدها.' }, question: { en: 'In this example, when is the final daal saakin?', fr: 'Ici, quand le dal final devient-il sans voyelle ?', ar: 'متى تسكن الدال الأخيرة في هذا المثال؟' }, choices: { en: ['When stopping', 'Only when speeding up', 'Never'], fr: ['À l’arrêt', 'Seulement en accélérant', 'Jamais'], ar: ['عند الوقف', 'عند الإسراع فقط', 'أبدًا'] }, answer: 0, source: 'https://alquran.cloud/tajweed-guide', reviewStatus: 'editorial-draft' },
    { id: 'madd', name: 'Natural Madd', ar: 'المد الطبيعي', surah: 113, ayah: 2, highlight: 'مَا', description: { en: 'The alif in this word lengthens the preceding fat-ha. This natural madd is taught as two counts at the recitation’s pace.', fr: 'L’alif allonge la fatha précédente. Ce madd naturel se lit sur deux temps au rythme de la récitation.', ar: 'الألف في هذه الكلمة تمد الفتحة قبلها. مقدار المد الطبيعي حركتان بحسب سرعة القراءة.' }, tip: { en: 'Not all madd rules have the same duration. This lesson covers natural madd only.', fr: 'Tous les types de madd n’ont pas la même durée. Cette leçon porte uniquement sur le madd naturel.', ar: 'ليست كل المدود بالمقدار نفسه. هذا الدرس للمد الطبيعي فقط.' }, question: { en: 'How many counts for this natural madd?', fr: 'Combien de temps pour ce madd naturel ?', ar: 'كم مقدار هذا المد الطبيعي؟' }, choices: { en: ['Two counts', 'Always six counts', 'No lengthening'], fr: ['Deux temps', 'Toujours six temps', 'Aucun allongement'], ar: ['حركتان', 'ست حركات دائمًا', 'لا مد'] }, answer: 0, source: 'https://alquran.cloud/tajweed-guide', reviewStatus: 'editorial-draft' }
];
