/**
 * Validators Utility Unit Tests
 */

const { Validators, ValidationError } = require('../../../src/utils/validators');

describe('Validators', () => {
    describe('validateLLMCallData', () => {
        it('should validate correct LLM call data', () => {
            const validData = {
                provider: 'openai',
                model: 'gpt-4',
                input: 'Test input',
                output: 'Test output',
                tokens: { input: 10, output: 20, total: 30 },
                cost: { input: 0.001, output: 0.002, total: 0.003 }
            };

            expect(() => Validators.validateLLMCallData(validData)).not.toThrow();
        });

        it('should require provider and model', () => {
            const invalidData = {
                input: 'Test input',
                output: 'Test output'
            };

            expect(() => Validators.validateLLMCallData(invalidData))
                .toThrow(ValidationError);
        });

        it('should validate token structure', () => {
            const invalidData = {
                provider: 'openai',
                model: 'gpt-4',
                tokens: { input: 'invalid', output: 20, total: 30 }
            };

            expect(() => Validators.validateLLMCallData(invalidData))
                .toThrow(ValidationError);
        });

        it('should validate cost structure', () => {
            const invalidData = {
                provider: 'openai',
                model: 'gpt-4',
                cost: { input: 'invalid', output: 0.002, total: 0.003 }
            };

            expect(() => Validators.validateLLMCallData(invalidData))
                .toThrow(ValidationError);
        });

        it('should allow optional fields to be undefined', () => {
            const validData = {
                provider: 'openai',
                model: 'gpt-4'
            };

            expect(() => Validators.validateLLMCallData(validData)).not.toThrow();
        });
    });

    describe('validateOperationName', () => {
        it('should validate correct operation names', () => {
            const validNames = ['chat_completion', 'embedding', 'text-generation', 'model.inference'];
            
            validNames.forEach(name => {
                expect(() => Validators.validateOperationName(name)).not.toThrow();
            });
        });

        it('should reject empty or null operation names', () => {
            expect(() => Validators.validateOperationName('')).toThrow(ValidationError);
            expect(() => Validators.validateOperationName(null)).toThrow(ValidationError);
            expect(() => Validators.validateOperationName(undefined)).toThrow(ValidationError);
        });

        it('should reject operation names that are too long', () => {
            const longName = 'a'.repeat(101);
            expect(() => Validators.validateOperationName(longName)).toThrow(ValidationError);
        });

        it('should reject operation names with invalid characters', () => {
            const invalidNames = ['operation with spaces', 'operation@invalid', 'operation#hash'];
            
            invalidNames.forEach(name => {
                expect(() => Validators.validateOperationName(name)).toThrow(ValidationError);
            });
        });
    });

    describe('validateTraceId', () => {
        it('should validate correct UUID v4 format', () => {
            const validUuids = [
                '123e4567-e89b-12d3-a456-426614174000',
                'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
            ];

            validUuids.forEach(uuid => {
                expect(() => Validators.validateTraceId(uuid)).not.toThrow();
            });
        });

        it('should reject invalid UUID formats', () => {
            const invalidUuids = [
                'not-a-uuid',
                '123e4567-e89b-12d3-a456',
                '123e4567-e89b-12d3-a456-426614174000-extra',
                ''
            ];

            invalidUuids.forEach(uuid => {
                expect(() => Validators.validateTraceId(uuid)).toThrow(ValidationError);
            });
        });
    });

    describe('validateMetricData', () => {
        it('should validate correct metric data', () => {
            const validMetrics = [
                {
                    name: 'test_metric',
                    value: 42,
                    type: 'gauge',
                    labels: { service: 'test' },
                    timestamp: Date.now()
                },
                {
                    name: 'counter_metric',
                    value: 1,
                    type: 'counter'
                }
            ];

            validMetrics.forEach(metric => {
                expect(() => Validators.validateMetricData(metric)).not.toThrow();
            });
        });

        it('should require name and value', () => {
            const invalidMetrics = [
                { value: 42 }, // missing name
                { name: 'test' }, // missing value
                {} // missing both
            ];

            invalidMetrics.forEach(metric => {
                expect(() => Validators.validateMetricData(metric)).toThrow(ValidationError);
            });
        });

        it('should validate metric types', () => {
            const invalidMetric = {
                name: 'test_metric',
                value: 42,
                type: 'invalid_type'
            };

            expect(() => Validators.validateMetricData(invalidMetric)).toThrow(ValidationError);
        });
    });

    describe('validateProvider', () => {
        it('should validate known providers', () => {
            const validProviders = ['openai', 'anthropic', 'google', 'azure', 'aws', 'cohere'];
            
            validProviders.forEach(provider => {
                expect(() => Validators.validateProvider(provider)).not.toThrow();
            });
        });

        it('should be case insensitive', () => {
            expect(() => Validators.validateProvider('OpenAI')).not.toThrow();
            expect(() => Validators.validateProvider('ANTHROPIC')).not.toThrow();
        });

        it('should reject unknown providers', () => {
            expect(() => Validators.validateProvider('unknown_provider')).toThrow(ValidationError);
        });
    });

    describe('validateModel', () => {
        it('should validate OpenAI models', () => {
            const validModels = ['gpt-4', 'gpt-3.5-turbo', 'text-davinci-003'];
            
            validModels.forEach(model => {
                expect(() => Validators.validateModel('openai', model)).not.toThrow();
            });
        });

        it('should validate Anthropic models', () => {
            const validModels = ['claude-3-opus', 'claude-2', 'claude-instant'];
            
            validModels.forEach(model => {
                expect(() => Validators.validateModel('anthropic', model)).not.toThrow();
            });
        });

        it('should reject invalid model for provider', () => {
            expect(() => Validators.validateModel('openai', 'claude-3')).toThrow(ValidationError);
            expect(() => Validators.validateModel('anthropic', 'gpt-4')).toThrow(ValidationError);
        });

        it('should allow custom providers with any model', () => {
            expect(() => Validators.validateModel('custom', 'any-model-name')).not.toThrow();
        });
    });

    describe('validateDateRange', () => {
        it('should validate correct date ranges', () => {
            const startDate = '2024-01-01T00:00:00Z';
            const endDate = '2024-01-02T00:00:00Z';
            
            expect(() => Validators.validateDateRange(startDate, endDate)).not.toThrow();
        });

        it('should reject invalid date formats', () => {
            expect(() => Validators.validateDateRange('invalid-date', '2024-01-02T00:00:00Z'))
                .toThrow(ValidationError);
        });

        it('should reject end date before start date', () => {
            const startDate = '2024-01-02T00:00:00Z';
            const endDate = '2024-01-01T00:00:00Z';
            
            expect(() => Validators.validateDateRange(startDate, endDate)).toThrow(ValidationError);
        });

        it('should reject date ranges exceeding 90 days', () => {
            const startDate = '2024-01-01T00:00:00Z';
            const endDate = '2024-04-01T00:00:00Z'; // More than 90 days
            
            expect(() => Validators.validateDateRange(startDate, endDate)).toThrow(ValidationError);
        });
    });

    describe('sanitizeInput', () => {
        it('should sanitize string input', () => {
            const input = 'Hello\x00World\x1F';
            const sanitized = Validators.sanitizeInput(input);
            
            expect(sanitized).toBe('HelloWorld');
        });

        it('should truncate long strings', () => {
            const longInput = 'a'.repeat(15000);
            const sanitized = Validators.sanitizeInput(longInput, 1000);
            
            expect(sanitized.length).toBe(1000);
        });

        it('should sanitize object properties recursively', () => {
            const input = {
                clean: 'normal text',
                dirty: 'text\x00with\x1Fcontrol\x08chars',
                nested: {
                    value: 'nested\x00value'
                }
            };
            
            const sanitized = Validators.sanitizeInput(input);
            
            expect(sanitized.dirty).toBe('textwithcontrolchars');
            expect(sanitized.nested.value).toBe('nestedvalue');
        });

        it('should handle non-string inputs', () => {
            expect(Validators.sanitizeInput(42)).toBe(42);
            expect(Validators.sanitizeInput(true)).toBe(true);
            expect(Validators.sanitizeInput(null)).toBe(null);
        });
    });
});