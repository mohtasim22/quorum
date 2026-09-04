const slugify = require('./slugify');

const uniqueSlug = async (Model, source, fallback) => {
  const base = slugify(source) || slugify(fallback) || 'user';

  let candidate = base;
  let n = 1;

  while (await Model.exists({ slug: candidate })) {
    n += 1;
    candidate = `${base}-${n}`;
  }

  return candidate;
};

module.exports = uniqueSlug;
