/**
 *
 * @param {String} UserPrompt
 * @param {String} modelName
 * @returns {Object}
 */

export const getModelId = (modelName) => {
  switch (modelName) {
    case 'claude-sonnet-4-20250514':
      return 'us.anthropic.claude-sonnet-4-20250514-v1:0'
    case 'claude-3-5-haiku-20241022':
      return 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
    case 'claude-3-7-sonnet-20250219':
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
    case 'deepseek-r1-v1':
      return 'us.deepseek.r1-v1:0'
    default:
      console.log('Invalid model selection. Defaulting to Claude Sonnet 3.')
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
  }
}
