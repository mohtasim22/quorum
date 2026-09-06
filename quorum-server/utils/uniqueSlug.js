const slugify = require('./slugify');

const uniqueSlug = async (delegate, source, fallback) => {
  const base = slugify(source) || slugify(fallback) || 'user';

  let candidate = base;
  let n = 1;

  while (await delegate.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }

  return candidate;
};


module.exports = uniqueSlug;
