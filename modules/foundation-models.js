/**
 * 
 * @param {String} UserPrompt 
 * @param {String} modelName 
 * @returns {Object}
 */

export const foundationModelsPayload = (UserPrompt, modelName) => {
    switch (modelName) {
        case 'claude-sonnet-4':
            return {
                    payload: {
                        anthropic_version: "bedrock-2023-05-31",
                        max_tokens: 512,
                        temperature: 0.3,
                        top_p: 0.3,
                        messages: [{ role: "user", content: [{ type: "text", text: UserPrompt }] }],
                    }
                };
        case 'claude-sonnet-3':
            return {
                    payload: {
                        anthropic_version: "bedrock-2023-05-31",
                        max_tokens: 512,
                        temperature: 0.3,
                        top_p: 0.3,
                        messages: [{ role: "user", content: [{ type: "text", text: UserPrompt }] }],
                    }
                };
        case 'deepseek':
            return {
                    payload: {
                        prompt: UserPrompt,
                        max_tokens: 512,
                        temperature: 0.3,
                        top_p: 0.9,
                        stop: ["</think>", "<|end_of_sentence|>"]
                }
            };
        default:
            console.log("Invalid model selection. Defaulting to Claude Sonnet 4.");
    }
    return {
            payload: {
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 1000,
                temperature: 0.3,
                top_p: 0.3,
                messages: [{ role: "user", content: [{ type: "text", text: UserPrompt }] }],
            }
        };
}

export const getModelId = (modelName) => {
    switch (modelName) {
        case 'claude-sonnet-4':
            return "us.anthropic.claude-sonnet-4-20250514-v1:0";
        case 'claude-sonnet-3':
            return "us.anthropic.claude-3-7-sonnet-20250219-v1:0";
        case 'deepseek':
            return "us.deepseek.r1-v1:0";
        default:
            console.log("Invalid model selection. Defaulting to Claude Sonnet 4.");
            return "us.anthropic.claude-sonnet-4-20250514-v1:0";
    }
}