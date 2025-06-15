/**
 *
 * @param {String} UserPrompt
 * @param {String} modelName
 * @returns {Object}
 */

const modelConfigration = (UserPrompt, max_tokens, temperature) => ({
  claude: {
    payload: {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: max_tokens > 1024 ? 1024 : max_tokens,
      temperature: temperature > 0.3 ? 0.3 : temperature,
      top_p: 0.3,
      messages: [{ role: 'user', content: [{ type: 'text', text: UserPrompt }] }]
    }
  }
})

export const foundationModelsPayload = (UserPrompt, modelName, max_tokens, temperature) => {
  const config = modelConfigration(UserPrompt, max_tokens, temperature);
  
  switch (modelName) {
    case 'claude-sonnet-4-20250514':
      return config.claude.payload
    case 'claude-3-7-sonnet-20250219':
      return config.claude.payload
    case 'claude-3-5-haiku-20241022':
      return config.claude.payload
    default:
      console.log('Invalid model selection. Defaulting to Claude Sonnet 3.')
      return config.claude.payload
  }
}

export const getModelId = (modelName) => {
  switch (modelName) {
    case 'claude-sonnet-4-20250514':
      return 'us.anthropic.claude-sonnet-4-20250514-v1:0'
    case 'claude-3-5-haiku-20241022':
      return 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
    case 'claude-3-7-sonnet-20250219':
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
    default:
      console.log('Invalid model selection. Defaulting to Claude Sonnet 3.')
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
  }
}
