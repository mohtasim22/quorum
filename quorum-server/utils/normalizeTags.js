const slugify = require('./slugify');

const normalizeTags = (tags = []) => {
  if (!Array.isArray(tags)) return [];

  const cleaned = tags
    .map((t) => slugify(String(t)))
    .filter(Boolean);

  return [...new Set(cleaned)].slice(0, 5);
};

module.exports = normalizeTags;
