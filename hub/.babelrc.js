module.exports = (api) => {
  api.cache.using(() => process.env.NODE_ENV)
  const opts = {
    presets: [
      '@babel/preset-flow'
    ],
    plugins: [
      '@babel/plugin-transform-modules-commonjs'
    ],
    retainLines: true
  }
  if (api.env('test')) {
    opts.plugins.push('istanbul');
  }
  return opts;
}