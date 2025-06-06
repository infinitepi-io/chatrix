import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process'
// import { get } from 'node:http';
import { getModelId } from './modules/foundation-models.js';


async function getUserInput(modelName) {
    const rl = readline.createInterface({ input , output });
    const model = await rl.question(modelName);
    rl.close();
    return model;
}

async function selectFoundationModel() {
    let modelId;
    return await getUserInput("Select model (claude-sonnet-4, claude-sonnet-3, deepseek): ").then((modelName) => {
        if (modelName == "claude-sonnet-4") {
            console.log("Using Anthropic Claude 4 Sonnet model.");
            modelId = getModelId(modelName);
        } else if (modelName == "claude-sonnet-3") {
            console.log("Using Anthropic Claude 3 Sonnet model.");
            modelId = getModelId(modelName);
        } else if (modelName == "deepseek") {
            console.log("Using DeepSeek R1 model.");
            modelId = getModelId(modelName);
        } else {
            console.log("Invalid model selection. Defaulting to Claude Sonnet 4.");
            modelId = getModelId("claude-sonnet-4");
    }
       console.log(`Selected model ID: ${modelId}`);
        return { modelId, modelName };
});
}
async function main() {
    try {
        const { modelId, modelName } = await selectFoundationModel();
        console.log(`Model ID: ${modelId}`);
        console.log(`Model Name: ${modelName}`);
    } catch (error) {
        console.error('Error:', error);
    }
}

main();