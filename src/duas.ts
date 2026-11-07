/** Quranic supplications for the ayah of the day: references only (surah, first ayah, last ayah). The Arabic is read
 * from the Tanzil corpus, never stored here. The list follows the widely published "Rabbana" and "Rabbi" du'as; a
 * du'a that runs over several ayahs is kept together. Review status: awaiting scholar review (like the adhkar).
 * tests/adhkar.test.mjs checks that every entry exists and addresses "رَبَّنَا" or "رَبِّ". */
export const DUAS_REVIEW = 'awaiting-scholar-review';
export const QURANIC_DUAS: readonly (readonly [number, number, number])[] = [
    // Rabbana
    [2, 127, 127], [2, 128, 128], [2, 201, 201], [2, 250, 250], [2, 286, 286], [3, 8, 8], [3, 9, 9], [3, 16, 16], [3, 53, 53], [3, 147, 147],
    [3, 191, 191], [3, 192, 192], [3, 193, 193], [3, 194, 194], [5, 83, 83], [5, 114, 114], [7, 23, 23], [7, 47, 47], [7, 89, 89], [7, 126, 126],
    [10, 85, 86], [14, 38, 38], [14, 40, 41], [18, 10, 10], [23, 109, 109], [25, 65, 66], [25, 74, 74], [40, 7, 7], [40, 8, 9],
    [59, 10, 10], [60, 4, 4], [60, 5, 5], [66, 8, 8],
    // Rabbi
    [2, 126, 126], [3, 38, 38], [7, 151, 151], [11, 47, 47], [12, 101, 101], [14, 35, 35], [17, 24, 24], [17, 80, 80], [20, 25, 28], [20, 114, 114],
    [21, 89, 89], [23, 29, 29], [23, 97, 98], [23, 118, 118], [26, 83, 85], [26, 169, 169], [27, 19, 19], [28, 16, 16], [28, 21, 21], [28, 24, 24],
    [29, 30, 30], [37, 100, 100], [46, 15, 15], [66, 11, 11], [71, 28, 28],
];
