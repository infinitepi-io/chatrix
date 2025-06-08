/**
 *
 * @param {String} UserPrompt
 * @param {String} modelName
 * @returns {Object}
 */

const modelConfigration = (UserPrompt, max_tokens, temperature, top_p) => ({
  claude: {
    payload: {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: max_tokens > 1024 ? 1024 : max_tokens,
      temperature: temperature >0.3 ? 0.3 : temperature,
      top_p: top_p > 0.3 ? 0.3 : top_p,
      messages: [{ role: 'user', content: [{ type: 'text', text: UserPrompt }] }]
    }
  },
  deepseek: {
    payload: {
      prompt: UserPrompt,
      max_tokens: max_tokens,
      temperature: temperature,
      top_p: top_p,
      stop: ['</think>', '<|end_of_sentence|>']
    }
  }
})

export const foundationModelsPayload = (UserPrompt, modelName, max_tokens, temperature, top_p) => {
  const config = modelConfigration(UserPrompt, max_tokens, temperature, top_p);
  
  switch (modelName) {
    case 'claude-sonnet-4':
      return config.claude.payload
    case 'claude-sonnet-3':
      return config.claude.payload
    case 'deepseek':
      return config.deepseek.payload
    default:
      console.log('Invalid model selection. Defaulting to Claude Sonnet 4.')
      return config.claude.payload
  }
}

export const getModelId = (modelName) => {
  switch (modelName) {
    case 'claude-sonnet-4':
      return 'us.anthropic.claude-sonnet-4-20250514-v1:0'
    case 'claude-sonnet-3':
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
    case 'deepseek':
      return 'us.deepseek.r1-v1:0'
    default:
      console.log('Invalid model selection. Defaulting to Claude Sonnet 3.')
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
  }
}
