## Claude Models 
```
anthropic.claude-sonnet-4-20250514-v1:0
arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0
```

use : InvokeModelCommand

InvokeModelCommand
Returns the complete response in a single chunk
Waits for the entire generation to complete before returning
Better for short, one-off responses
Simpler to implement and handle
Uses more memory as it holds the entire response
InvokeModelWithResponseStreamCommand
Returns the response in real-time as chunks/tokens
Starts returning data as soon as the model begins generating
Ideal for:
Long-form content generation
Interactive chat interfaces
Progress indicators
Real-time display of responses
More efficient memory usage
Lower latency for first-token response
Requires handling streaming data and state management
Think of it like:

InvokeModelCommand = Waiting for a complete letter in the mail
InvokeModelWithResponseStreamCommand = Getting words in real-time during a phone conversation
The streaming version is particularly useful when you want to:

Show typing-like effects
Handle very long responses
Provide immediate feedback to users
Implement cancellation mid-generation
Build interactive applications
The trade-off is increased complexity in handling the streaming response and maintaining state.

https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-configure-reasoning.html
https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-text-completion.html


Next:
use InvokeModelWithResponseStreamCommand and take user input.

## Docs
https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/
https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/command/InvokeModelCommand/
https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock_code_examples.html
https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan.html
https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-configure-reasoning.html
https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-text-completion.html
https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-deepseek.html
https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-bedrock-runtime/
https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock-runtime_code_examples.html
