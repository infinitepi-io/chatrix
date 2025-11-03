/**
 *
 * @param {String} UserPrompt
 * @param {String} modelName
 * @returns {Object}
 */

export const getModelId = (modelName) => {
  switch (modelName) {
    // Claude Sonnet 4.5 (US cross-region)
    case 'claude-sonnet-4-5-20250929':
      return 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'

    // Claude Sonnet 4 (US cross-region)
    case 'claude-sonnet-4-20250514':
      return 'us.anthropic.claude-sonnet-4-20250514-v1:0'

    // Claude Haiku 4.5 (US cross-region)
    case 'claude-haiku-4-5-20251001':
      return 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

    // Claude 3.5 Haiku (US cross-region)
    case 'claude-3-5-haiku-20241022':
      return 'us.anthropic.claude-3-5-haiku-20241022-v1:0'

    // Claude Opus 4.1 (US cross-region)
    case 'claude-opus-4-1-20250805':
      return 'us.anthropic.claude-opus-4-1-20250805-v1:0'

    // Claude 3.7 Sonnet (US cross-region)
    case 'claude-3-7-sonnet-20250219':
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'

    // DeepSeek (US cross-region)
    case 'deepseek-r1-v1':
      return 'us.deepseek.r1-v1:0'

    default:
      console.log('Invalid model selection. Defaulting to Claude 3.7 Sonnet.')
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
  }
}
