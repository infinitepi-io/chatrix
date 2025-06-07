/**
 *
 * @param {String} UserPrompt
 * @param {String} modelName
 * @returns {Object}
 */

const modelConfigration = (UserPrompt) => ({
  claude: {
    payload: {
      anthropic_version: 'bedrock-2023-05-31',
      maxToken: 512,
      temperature: 0.3,
      topP: 0.3,
      messages: [{ role: 'user', content: [{ type: 'text', text: UserPrompt }] }]

    }
  },
  deepseek: {
    payload: {
      prompt: UserPrompt,
      max_tokens: 512,
      temperature: 0.3,
      top_p: 0.9,
      stop: ['</think>', '<|end_of_sentence|>']
    }
  }
})

export const foundationModelsPayload = (UserPrompt, modelName) => {
  switch (modelName) {
    case 'claude-sonnet-4':
      return modelConfigration.claude.payload(UserPrompt)
    case 'claude-sonnet-3':
      return modelConfigration.claude.payload(UserPrompt)
    case 'deepseek':
      return modelConfigration.deepseek.payload(UserPrompt)
    default:
      console.log('Invalid model selection. Defaulting to Claude Sonnet 4.')
  }
  return modelConfigration.claude.payload(UserPrompt)
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
      console.log('Invalid model selection. Defaulting to Claude Sonnet 4.')
      return 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
  }
}
