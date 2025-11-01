# Claude 4.5 Breaking Changes - AWS Bedrock

## Temperature and Top-P Restriction

### Summary
Claude Sonnet 4.5 and Claude Haiku 4.5 (released 2025) introduced a breaking change where you can only specify **ONE** sampling parameter: either `temperature` OR `top_p`, but not both.

### Error Message
```
ValidationException: `temperature` and `top_p` cannot both be specified for this model. Please use only one.
```

### Affected Models
- ✗ Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- ✗ Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- ✗ Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- ✗ Claude Opus 4.1 (`claude-opus-4-1-20250805`)
- ✓ Claude 3.7 Sonnet (supports both)
- ✓ Claude 3.5 Haiku (supports both)
- ✓ All Claude 3.x models (support both)

### Technical Reason
Both `temperature` and `top_p` control randomness in token selection:

- **Temperature**: Controls how much the model favors high-probability tokens
  - 0 = deterministic (always picks highest probability)
  - 1 = creative (more randomness)

- **Top-p (nucleus sampling)**: Limits token selection to top X% of probability mass
  - 0.9 = select from top 90% of probability distribution

Using both creates conflicting/redundant sampling strategies. Anthropic optimized Claude 4.5+ to require choosing one method.

### Solution
Use `temperature` only (more common and easier to understand). Remove `topP` parameter for Claude 4.5+ models.

### References
- [GitHub Issue - deepeval #2133](https://github.com/confident-ai/deepeval/issues/2133)
- [GitHub Issue - pipecat #2878](https://github.com/pipecat-ai/pipecat/issues/2878)
- [GitHub Issue - mlflow #11315](https://github.com/mlflow/mlflow/issues/11315)

### Implementation in Chatrix
See `index.js` for conditional logic that handles both old and new Claude models appropriately.