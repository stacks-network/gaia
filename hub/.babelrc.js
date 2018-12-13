module.exports = (api) => {

  api.cache.invalidate(() => true)

  const isTestEnv = api.env('test')
  console.log(`[Babel] Running for env: ${api.env()}`)

  const opts = {
    presets: [
      '@babel/preset-flow'
    ],
    plugins: [
      '@babel/plugin-transform-modules-commonjs'
    ]
  }

  if (isTestEnv) {
    opts.plugins.push('istanbul');
  }

  return opts;
}