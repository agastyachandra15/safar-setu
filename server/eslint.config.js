import rootConfig from '../eslint.config.js'
import globals from 'globals'

export default [
  ...rootConfig,
  {
    languageOptions: {
      globals: globals.node,
    },
  },
]
