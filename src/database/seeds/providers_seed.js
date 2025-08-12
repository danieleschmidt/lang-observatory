/**
 * Seed data for LLM providers and models
 * Populates the database with current LLM provider information
 */

const providers = [
  {
    name: 'openai',
    display_name: 'OpenAI',
    api_base_url: 'https://api.openai.com/v1',
    pricing_model: {
      type: 'token_based',
      billing_unit: 'token',
      currency: 'USD',
    },
    supported_features: {
      chat_completion: true,
      text_completion: true,
      embeddings: true,
      fine_tuning: true,
      function_calling: true,
      streaming: true,
    },
  },
  {
    name: 'anthropic',
    display_name: 'Anthropic',
    api_base_url: 'https://api.anthropic.com',
    pricing_model: {
      type: 'token_based',
      billing_unit: 'token',
      currency: 'USD',
    },
    supported_features: {
      chat_completion: true,
      text_completion: true,
      streaming: true,
      system_prompts: true,
      tool_use: true,
    },
  },
  {
    name: 'google',
    display_name: 'Google AI',
    api_base_url: 'https://generativelanguage.googleapis.com',
    pricing_model: {
      type: 'token_based',
      billing_unit: 'character',
      currency: 'USD',
    },
    supported_features: {
      chat_completion: true,
      text_completion: true,
      embeddings: true,
      multimodal: true,
    },
  },
  {
    name: 'azure',
    display_name: 'Azure OpenAI',
    api_base_url: 'https://api.cognitive.microsoft.com',
    pricing_model: {
      type: 'token_based',
      billing_unit: 'token',
      currency: 'USD',
    },
    supported_features: {
      chat_completion: true,
      text_completion: true,
      embeddings: true,
      fine_tuning: true,
      function_calling: true,
    },
  },
  {
    name: 'aws',
    display_name: 'AWS Bedrock',
    api_base_url: 'https://bedrock-runtime.amazonaws.com',
    pricing_model: {
      type: 'token_based',
      billing_unit: 'token',
      currency: 'USD',
    },
    supported_features: {
      chat_completion: true,
      text_completion: true,
      embeddings: true,
      streaming: true,
    },
  },
  {
    name: 'cohere',
    display_name: 'Cohere',
    api_base_url: 'https://api.cohere.ai',
    pricing_model: {
      type: 'token_based',
      billing_unit: 'token',
      currency: 'USD',
    },
    supported_features: {
      chat_completion: true,
      text_completion: true,
      embeddings: true,
      rerank: true,
      classification: true,
    },
  },
  {
    name: 'huggingface',
    display_name: 'Hugging Face',
    api_base_url: 'https://api-inference.huggingface.co',
    pricing_model: {
      type: 'usage_based',
      billing_unit: 'request',
      currency: 'USD',
    },
    supported_features: {
      text_completion: true,
      embeddings: true,
      classification: true,
      custom_models: true,
    },
  },
];

const models = [
  // OpenAI Models
  {
    provider_name: 'openai',
    name: 'gpt-4',
    display_name: 'GPT-4',
    context_length: 8192,
    max_tokens: 4096,
    input_cost_per_token: 0.00003,
    output_cost_per_token: 0.00006,
    capabilities: {
      reasoning: 'excellent',
      coding: 'excellent',
      math: 'excellent',
      creativity: 'excellent',
      instruction_following: 'excellent',
    },
  },
  {
    provider_name: 'openai',
    name: 'gpt-4-turbo',
    display_name: 'GPT-4 Turbo',
    context_length: 128000,
    max_tokens: 4096,
    input_cost_per_token: 0.00001,
    output_cost_per_token: 0.00003,
    capabilities: {
      reasoning: 'excellent',
      coding: 'excellent',
      math: 'excellent',
      creativity: 'excellent',
      instruction_following: 'excellent',
      multimodal: true,
    },
  },
  {
    provider_name: 'openai',
    name: 'gpt-4o',
    display_name: 'GPT-4o',
    context_length: 128000,
    max_tokens: 4096,
    input_cost_per_token: 0.000005,
    output_cost_per_token: 0.000015,
    capabilities: {
      reasoning: 'excellent',
      coding: 'excellent',
      math: 'excellent',
      creativity: 'excellent',
      instruction_following: 'excellent',
      multimodal: true,
      speed: 'fast',
    },
  },
  {
    provider_name: 'openai',
    name: 'gpt-3.5-turbo',
    display_name: 'GPT-3.5 Turbo',
    context_length: 16385,
    max_tokens: 4096,
    input_cost_per_token: 0.0000015,
    output_cost_per_token: 0.000002,
    capabilities: {
      reasoning: 'good',
      coding: 'good',
      math: 'good',
      creativity: 'good',
      instruction_following: 'good',
      speed: 'fast',
    },
  },
  {
    provider_name: 'openai',
    name: 'text-embedding-3-large',
    display_name: 'Text Embedding 3 Large',
    context_length: 8191,
    max_tokens: null,
    input_cost_per_token: 0.00000013,
    output_cost_per_token: 0,
    capabilities: {
      embeddings: 'excellent',
      dimensions: 3072,
    },
  },

  // Anthropic Models
  {
    provider_name: 'anthropic',
    name: 'claude-3-opus',
    display_name: 'Claude 3 Opus',
    context_length: 200000,
    max_tokens: 4096,
    input_cost_per_token: 0.000015,
    output_cost_per_token: 0.000075,
    capabilities: {
      reasoning: 'excellent',
      coding: 'excellent',
      math: 'excellent',
      creativity: 'excellent',
      instruction_following: 'excellent',
      analysis: 'excellent',
    },
  },
  {
    provider_name: 'anthropic',
    name: 'claude-3-sonnet',
    display_name: 'Claude 3 Sonnet',
    context_length: 200000,
    max_tokens: 4096,
    input_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    capabilities: {
      reasoning: 'excellent',
      coding: 'excellent',
      math: 'good',
      creativity: 'good',
      instruction_following: 'excellent',
      speed: 'fast',
    },
  },
  {
    provider_name: 'anthropic',
    name: 'claude-3-haiku',
    display_name: 'Claude 3 Haiku',
    context_length: 200000,
    max_tokens: 4096,
    input_cost_per_token: 0.00000025,
    output_cost_per_token: 0.00000125,
    capabilities: {
      reasoning: 'good',
      coding: 'good',
      math: 'fair',
      creativity: 'fair',
      instruction_following: 'good',
      speed: 'very_fast',
    },
  },

  // Google Models
  {
    provider_name: 'google',
    name: 'gemini-pro',
    display_name: 'Gemini Pro',
    context_length: 32768,
    max_tokens: 8192,
    input_cost_per_token: 0.000000125,
    output_cost_per_token: 0.000000375,
    capabilities: {
      reasoning: 'good',
      coding: 'good',
      math: 'good',
      creativity: 'good',
      multimodal: true,
    },
  },
  {
    provider_name: 'google',
    name: 'gemini-ultra',
    display_name: 'Gemini Ultra',
    context_length: 32768,
    max_tokens: 8192,
    input_cost_per_token: 0.000000125,
    output_cost_per_token: 0.000000375,
    capabilities: {
      reasoning: 'excellent',
      coding: 'excellent',
      math: 'excellent',
      creativity: 'excellent',
      multimodal: true,
    },
  },

  // AWS Bedrock Models
  {
    provider_name: 'aws',
    name: 'anthropic.claude-3-opus-20240229-v1:0',
    display_name: 'Claude 3 Opus (Bedrock)',
    context_length: 200000,
    max_tokens: 4096,
    input_cost_per_token: 0.000015,
    output_cost_per_token: 0.000075,
    capabilities: {
      reasoning: 'excellent',
      coding: 'excellent',
      math: 'excellent',
      creativity: 'excellent',
    },
  },
  {
    provider_name: 'aws',
    name: 'amazon.titan-text-express-v1',
    display_name: 'Titan Text Express',
    context_length: 8000,
    max_tokens: 8000,
    input_cost_per_token: 0.0000008,
    output_cost_per_token: 0.0000016,
    capabilities: {
      reasoning: 'fair',
      coding: 'fair',
      creativity: 'fair',
    },
  },

  // Cohere Models
  {
    provider_name: 'cohere',
    name: 'command-r-plus',
    display_name: 'Command R+',
    context_length: 128000,
    max_tokens: 4000,
    input_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    capabilities: {
      reasoning: 'good',
      coding: 'good',
      rag: 'excellent',
      multilingual: true,
    },
  },
  {
    provider_name: 'cohere',
    name: 'command-r',
    display_name: 'Command R',
    context_length: 128000,
    max_tokens: 4000,
    input_cost_per_token: 0.0000015,
    output_cost_per_token: 0.000002,
    capabilities: {
      reasoning: 'good',
      coding: 'fair',
      rag: 'good',
      multilingual: true,
    },
  },
];

async function seedProviders(db) {
  console.log('Seeding providers...');

  for (const provider of providers) {
    try {
      await db.query(
        `
                INSERT INTO providers (name, display_name, api_base_url, pricing_model, supported_features)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (name) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    api_base_url = EXCLUDED.api_base_url,
                    pricing_model = EXCLUDED.pricing_model,
                    supported_features = EXCLUDED.supported_features,
                    updated_at = CURRENT_TIMESTAMP
            `,
        [
          provider.name,
          provider.display_name,
          provider.api_base_url,
          JSON.stringify(provider.pricing_model),
          JSON.stringify(provider.supported_features),
        ]
      );

      console.log(`✓ Provider: ${provider.display_name}`);
    } catch (error) {
      console.error(
        `✗ Failed to seed provider ${provider.name}:`,
        error.message
      );
    }
  }
}

async function seedModels(db) {
  console.log('Seeding models...');

  for (const model of models) {
    try {
      const providerResult = await db.query(
        'SELECT id FROM providers WHERE name = $1',
        [model.provider_name]
      );

      if (providerResult.rows.length === 0) {
        console.warn(
          `⚠ Provider ${model.provider_name} not found for model ${model.name}`
        );
        continue;
      }

      const providerId = providerResult.rows[0].id;

      await db.query(
        `
                INSERT INTO models (
                    provider_id, name, display_name, context_length, max_tokens,
                    input_cost_per_token, output_cost_per_token, capabilities
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (provider_id, name) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    context_length = EXCLUDED.context_length,
                    max_tokens = EXCLUDED.max_tokens,
                    input_cost_per_token = EXCLUDED.input_cost_per_token,
                    output_cost_per_token = EXCLUDED.output_cost_per_token,
                    capabilities = EXCLUDED.capabilities,
                    updated_at = CURRENT_TIMESTAMP
            `,
        [
          providerId,
          model.name,
          model.display_name,
          model.context_length,
          model.max_tokens,
          model.input_cost_per_token,
          model.output_cost_per_token,
          JSON.stringify(model.capabilities),
        ]
      );

      console.log(`✓ Model: ${model.display_name}`);
    } catch (error) {
      console.error(`✗ Failed to seed model ${model.name}:`, error.message);
    }
  }
}

async function runSeed(db) {
  try {
    console.log('Starting database seeding...');

    await seedProviders(db);
    await seedModels(db);

    console.log('✅ Database seeding completed successfully');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

module.exports = {
  runSeed,
  seedProviders,
  seedModels,
  providers,
  models,
};
