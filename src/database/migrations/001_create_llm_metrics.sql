-- Migration 001: Create LLM Metrics Tables
-- Creates tables for storing LLM usage metrics and traces

-- ============================================================================
-- LLM Providers and Models
-- ============================================================================

CREATE TABLE IF NOT EXISTS providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    api_base_url VARCHAR(500),
    pricing_model JSONB,
    supported_features JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    display_name VARCHAR(300),
    context_length INTEGER,
    max_tokens INTEGER,
    input_cost_per_token DECIMAL(12, 8),
    output_cost_per_token DECIMAL(12, 8),
    capabilities JSONB,
    deprecated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, name)
);

-- ============================================================================
-- LLM Usage Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_calls (
    id BIGSERIAL PRIMARY KEY,
    trace_id UUID NOT NULL,
    session_id VARCHAR(100),
    provider_id INTEGER REFERENCES providers(id),
    model_id INTEGER REFERENCES models(id),
    
    -- Request/Response data
    input_text TEXT,
    output_text TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    
    -- Cost tracking
    input_cost DECIMAL(12, 8),
    output_cost DECIMAL(12, 8),
    total_cost DECIMAL(12, 8),
    
    -- Performance metrics
    latency_ms INTEGER,
    time_to_first_token_ms INTEGER,
    tokens_per_second DECIMAL(8, 2),
    
    -- Status and metadata
    status VARCHAR(50) DEFAULT 'success',
    error_message TEXT,
    metadata JSONB,
    
    -- Timestamps
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Trace Management
-- ============================================================================

CREATE TABLE IF NOT EXISTS traces (
    id UUID PRIMARY KEY,
    operation VARCHAR(200) NOT NULL,
    session_id VARCHAR(100),
    user_id VARCHAR(100),
    
    -- Trace hierarchy
    parent_trace_id UUID REFERENCES traces(id),
    root_trace_id UUID,
    
    -- Status and timing
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    -- Aggregated metrics
    total_llm_calls INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(12, 8) DEFAULT 0,
    
    -- Metadata
    metadata JSONB,
    tags JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Metrics Aggregations
-- ============================================================================

CREATE TABLE IF NOT EXISTS hourly_metrics (
    id BIGSERIAL PRIMARY KEY,
    hour_bucket TIMESTAMP NOT NULL,
    provider_id INTEGER REFERENCES providers(id),
    model_id INTEGER REFERENCES models(id),
    
    -- Aggregated counts
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    
    -- Token usage
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    
    -- Cost aggregations
    total_input_cost DECIMAL(12, 4) DEFAULT 0,
    total_output_cost DECIMAL(12, 4) DEFAULT 0,
    total_cost DECIMAL(12, 4) DEFAULT 0,
    
    -- Performance metrics
    avg_latency_ms DECIMAL(8, 2),
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    min_latency_ms INTEGER,
    max_latency_ms INTEGER,
    avg_tokens_per_second DECIMAL(8, 2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(hour_bucket, provider_id, model_id)
);

CREATE TABLE IF NOT EXISTS daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    date_bucket DATE NOT NULL,
    provider_id INTEGER REFERENCES providers(id),
    model_id INTEGER REFERENCES models(id),
    
    -- Aggregated counts
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    
    -- Token usage
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    
    -- Cost aggregations
    total_input_cost DECIMAL(12, 4) DEFAULT 0,
    total_output_cost DECIMAL(12, 4) DEFAULT 0,
    total_cost DECIMAL(12, 4) DEFAULT 0,
    
    -- Performance metrics
    avg_latency_ms DECIMAL(8, 2),
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    avg_tokens_per_second DECIMAL(8, 2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(date_bucket, provider_id, model_id)
);

-- ============================================================================
-- Alert and Monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    
    -- Context
    provider_id INTEGER REFERENCES providers(id),
    model_id INTEGER REFERENCES models(id),
    operation VARCHAR(200),
    
    -- Alert data
    threshold_value DECIMAL(12, 4),
    actual_value DECIMAL(12, 4),
    metadata JSONB,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(100),
    resolved_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- LLM calls indexes
CREATE INDEX idx_llm_calls_trace_id ON llm_calls(trace_id);
CREATE INDEX idx_llm_calls_session_id ON llm_calls(session_id);
CREATE INDEX idx_llm_calls_provider_model ON llm_calls(provider_id, model_id);
CREATE INDEX idx_llm_calls_started_at ON llm_calls(started_at);
CREATE INDEX idx_llm_calls_status ON llm_calls(status);

-- Traces indexes
CREATE INDEX idx_traces_session_id ON traces(session_id);
CREATE INDEX idx_traces_user_id ON traces(user_id);
CREATE INDEX idx_traces_operation ON traces(operation);
CREATE INDEX idx_traces_status ON traces(status);
CREATE INDEX idx_traces_started_at ON traces(started_at);
CREATE INDEX idx_traces_parent_trace_id ON traces(parent_trace_id);

-- Metrics indexes
CREATE INDEX idx_hourly_metrics_bucket ON hourly_metrics(hour_bucket);
CREATE INDEX idx_hourly_metrics_provider_model ON hourly_metrics(provider_id, model_id);
CREATE INDEX idx_daily_metrics_bucket ON daily_metrics(date_bucket);
CREATE INDEX idx_daily_metrics_provider_model ON daily_metrics(provider_id, model_id);

-- Alerts indexes
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_type ON alerts(alert_type);

-- ============================================================================
-- Functions for Automatic Updates
-- ============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_traces_updated_at BEFORE UPDATE ON traces 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hourly_metrics_updated_at BEFORE UPDATE ON hourly_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON daily_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Insert Initial Data
-- ============================================================================

-- Insert common LLM providers
INSERT INTO providers (name, display_name, api_base_url, pricing_model) VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', '{"type": "token_based", "billing_unit": "token"}'),
('anthropic', 'Anthropic', 'https://api.anthropic.com', '{"type": "token_based", "billing_unit": "token"}'),
('google', 'Google AI', 'https://generativelanguage.googleapis.com', '{"type": "token_based", "billing_unit": "character"}'),
('azure', 'Azure OpenAI', 'https://api.cognitive.microsoft.com', '{"type": "token_based", "billing_unit": "token"}'),
('aws', 'AWS Bedrock', 'https://bedrock-runtime.amazonaws.com', '{"type": "token_based", "billing_unit": "token"}'),
('cohere', 'Cohere', 'https://api.cohere.ai', '{"type": "token_based", "billing_unit": "token"}'),
('huggingface', 'Hugging Face', 'https://api-inference.huggingface.co', '{"type": "usage_based", "billing_unit": "request"}')
ON CONFLICT (name) DO NOTHING;

-- Insert common models
INSERT INTO models (provider_id, name, display_name, context_length, input_cost_per_token, output_cost_per_token) VALUES
((SELECT id FROM providers WHERE name = 'openai'), 'gpt-4', 'GPT-4', 8192, 0.00003, 0.00006),
((SELECT id FROM providers WHERE name = 'openai'), 'gpt-4-turbo', 'GPT-4 Turbo', 128000, 0.00001, 0.00003),
((SELECT id FROM providers WHERE name = 'openai'), 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 4096, 0.0000015, 0.000002),
((SELECT id FROM providers WHERE name = 'anthropic'), 'claude-3-opus', 'Claude 3 Opus', 200000, 0.000015, 0.000075),
((SELECT id FROM providers WHERE name = 'anthropic'), 'claude-3-sonnet', 'Claude 3 Sonnet', 200000, 0.000003, 0.000015),
((SELECT id FROM providers WHERE name = 'anthropic'), 'claude-3-haiku', 'Claude 3 Haiku', 200000, 0.00000025, 0.00000125)
ON CONFLICT (provider_id, name) DO NOTHING;