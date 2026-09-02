const slugify = (input = '') =>
  input
    .toString()
    .normalize('NFKD')                 // "José" → "Jose" + combining accent
    .replace(/[\u0300-\u036f]/g, '')   // drop the accent marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')      // keep letters, digits, spaces, hyphens
    .replace(/[\s_-]+/g, '-')          // collapse runs into a single hyphen
    .replace(/^-+|-+$/g, '');          // trim hyphens off both ends

module.exports = slugify;
