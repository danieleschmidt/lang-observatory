#!/usr/bin/env node

/**
 * Lang Observatory CLI
 * Command-line interface for managing the observability stack
 */

const { Command } = require('commander');
const { LangObservatory } = require('../index');
const { LangObservatoryServer } = require('../api/server');
const { Logger } = require('../utils/logger');
const { ConfigManager } = require('../utils/config');
const packageInfo = require('../../package.json');

class LangObservatoryCLI {
    constructor() {
        this.program = new Command();
        this.logger = new Logger({ service: 'cli' });
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('lang-observatory')
            .description('A turnkey observability stack for large language models')
            .version(packageInfo.version);

        // Start command
        this.program
            .command('start')
            .description('Start the Lang Observatory services')
            .option('-c, --config <path>', 'Configuration file path')
            .option('-p, --port <number>', 'API server port', '3000')
            .option('--host <address>', 'API server host', '0.0.0.0')
            .option('--api-only', 'Start only the API server')
            .option('--no-api', 'Start without API server')
            .action(async (options) => {
                try {
                    await this.startServices(options);
                } catch (error) {
                    this.logger.error('Failed to start services:', error);
                    process.exit(1);
                }
            });

        // Stop command
        this.program
            .command('stop')
            .description('Stop the Lang Observatory services')
            .action(async () => {
                try {
                    await this.stopServices();
                } catch (error) {
                    this.logger.error('Failed to stop services:', error);
                    process.exit(1);
                }
            });

        // Status command
        this.program
            .command('status')
            .description('Check the status of Lang Observatory services')
            .option('-c, --config <path>', 'Configuration file path')
            .option('--json', 'Output status as JSON')
            .action(async (options) => {
                try {
                    await this.checkStatus(options);
                } catch (error) {
                    this.logger.error('Failed to check status:', error);
                    process.exit(1);
                }
            });

        // Test command
        this.program
            .command('test')
            .description('Test LLM call recording')
            .option('-c, --config <path>', 'Configuration file path')
            .option('-p, --provider <name>', 'LLM provider', 'openai')
            .option('-m, --model <name>', 'Model name', 'gpt-3.5-turbo')
            .option('--input <text>', 'Test input text', 'Hello, world!')
            .option('--output <text>', 'Test output text', 'Hello! How can I help you today?')
            .action(async (options) => {
                try {
                    await this.testLLMCall(options);
                } catch (error) {
                    this.logger.error('Failed to test LLM call:', error);
                    process.exit(1);
                }
            });

        // Plan tasks command
        this.program
            .command('plan')
            .description('Plan tasks using quantum optimization')
            .option('-c, --config <path>', 'Configuration file path')
            .option('-f, --file <path>', 'Tasks file (JSON)')
            .option('--tasks <tasks>', 'Tasks as JSON string')
            .option('--constraints <constraints>', 'Constraints as JSON string')
            .action(async (options) => {
                try {
                    await this.planTasks(options);
                } catch (error) {
                    this.logger.error('Failed to plan tasks:', error);
                    process.exit(1);
                }
            });

        // Metrics command
        this.program
            .command('metrics')
            .description('Display current metrics')
            .option('-c, --config <path>', 'Configuration file path')
            .option('--format <format>', 'Output format (table|json)', 'table')
            .action(async (options) => {
                try {
                    await this.displayMetrics(options);
                } catch (error) {
                    this.logger.error('Failed to display metrics:', error);
                    process.exit(1);
                }
            });

        // Config commands
        const configCmd = this.program
            .command('config')
            .description('Configuration management');

        configCmd
            .command('validate')
            .description('Validate configuration')
            .option('-c, --config <path>', 'Configuration file path')
            .action(async (options) => {
                try {
                    await this.validateConfig(options);
                } catch (error) {
                    this.logger.error('Configuration validation failed:', error);
                    process.exit(1);
                }
            });

        configCmd
            .command('show')
            .description('Show current configuration')
            .option('-c, --config <path>', 'Configuration file path')
            .action(async (options) => {
                try {
                    await this.showConfig(options);
                } catch (error) {
                    this.logger.error('Failed to show configuration:', error);
                    process.exit(1);
                }
            });
    }

    async startServices(options) {
        this.logger.info('Starting Lang Observatory services...');

        // Load configuration
        const config = await this.loadConfig(options.config);
        
        if (options.port) config.api = { ...config.api, port: parseInt(options.port) };
        if (options.host) config.api = { ...config.api, host: options.host };

        // Start core observatory
        let observatory = null;
        if (!options.apiOnly) {
            observatory = new LangObservatory(config);
            await observatory.initialize();
            this.logger.info('Core observatory services started');
        }

        // Start API server
        let server = null;
        if (options.api !== false) {
            server = new LangObservatoryServer({
                ...config.api,
                observatory: config
            });
            await server.initialize();
            await server.start();
            this.logger.info(`API server started on ${config.api?.host || '0.0.0.0'}:${config.api?.port || 3000}`);
        }

        // Setup graceful shutdown
        const shutdown = async (signal) => {
            this.logger.info(`Received ${signal}, shutting down gracefully...`);
            
            if (server) {
                await server.shutdown();
            }
            
            if (observatory) {
                await observatory.shutdown();
            }
            
            this.logger.info('Shutdown complete');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        this.logger.info('Lang Observatory is running. Press Ctrl+C to stop.');
        
        // Keep process alive
        await new Promise(() => {});
    }

    async stopServices() {
        this.logger.info('Stopping Lang Observatory services...');
        // In a real implementation, this would connect to running services and stop them
        this.logger.info('Services stopped');
    }

    async checkStatus(options) {
        const config = await this.loadConfig(options.config);
        
        try {
            const observatory = new LangObservatory(config);
            await observatory.initialize();
            
            const status = await observatory.getHealthStatus();
            
            if (options.json) {
                console.log(JSON.stringify(status, null, 2));
            } else {
                this.displayStatusTable(status);
            }
            
            await observatory.shutdown();
            
        } catch (error) {
            if (options.json) {
                console.log(JSON.stringify({ status: 'error', error: error.message }, null, 2));
            } else {
                this.logger.error('Status check failed:', error);
            }
        }
    }

    async testLLMCall(options) {
        const config = await this.loadConfig(options.config);
        
        const observatory = new LangObservatory(config);
        await observatory.initialize();

        this.logger.info(`Testing LLM call with ${options.provider}/${options.model}...`);

        const result = await observatory.recordLLMCall(
            options.provider,
            options.model,
            options.input,
            options.output,
            {
                test: true,
                timestamp: new Date().toISOString()
            }
        );

        this.logger.info('LLM call recorded successfully');
        console.log('Call ID:', result.id);
        console.log('Neuromorphic Insights:', JSON.stringify(result.neuromorphicInsights, null, 2));

        await observatory.shutdown();
    }

    async planTasks(options) {
        const config = await this.loadConfig(options.config);
        
        let tasks = [];
        let constraints = {};

        // Load tasks from file or command line
        if (options.file) {
            const fs = require('fs');
            const taskData = JSON.parse(fs.readFileSync(options.file, 'utf8'));
            tasks = taskData.tasks || taskData;
            constraints = taskData.constraints || {};
        } else if (options.tasks) {
            tasks = JSON.parse(options.tasks);
        } else {
            // Default test tasks
            tasks = [
                { id: 'task1', priority: 0.8, estimatedDuration: 120 },
                { id: 'task2', priority: 0.6, estimatedDuration: 90 },
                { id: 'task3', priority: 0.9, estimatedDuration: 60 }
            ];
        }

        if (options.constraints) {
            constraints = { ...constraints, ...JSON.parse(options.constraints) };
        }

        const observatory = new LangObservatory(config);
        await observatory.initialize();

        this.logger.info(`Planning ${tasks.length} tasks using quantum optimization...`);

        const plan = await observatory.planTasks(tasks, constraints);

        console.log('\n=== Quantum Task Plan ===');
        console.log(`Total Duration: ${plan.totalDuration}ms`);
        console.log(`Efficiency: ${(plan.efficiency * 100).toFixed(1)}%`);
        console.log(`Parallelism: ${plan.parallelism.toFixed(2)}`);
        
        console.log('\nExecution Phases:');
        plan.quantumPlan.phases.forEach((phase, index) => {
            console.log(`\nPhase ${index + 1}:`);
            phase.tasks.forEach(taskInfo => {
                console.log(`  - ${taskInfo.task.id} (priority: ${taskInfo.task.priority}, duration: ${taskInfo.task.estimatedDuration}ms)`);
            });
        });

        await observatory.shutdown();
    }

    async displayMetrics(options) {
        const config = await this.loadConfig(options.config);
        
        const observatory = new LangObservatory(config);
        await observatory.initialize();

        const neuromorphicMetrics = await observatory.getNeuromorphicMetrics();
        const photonStats = observatory.getPhotonProcessorStats();

        if (options.format === 'json') {
            console.log(JSON.stringify({
                neuromorphic: neuromorphicMetrics,
                photonProcessor: photonStats
            }, null, 2));
        } else {
            console.log('\n=== Neuromorphic Metrics ===');
            console.log(`Processing Efficiency: ${(neuromorphicMetrics.processingEfficiency * 100).toFixed(1)}%`);
            console.log(`Average Confidence: ${(neuromorphicMetrics.averageConfidence * 100).toFixed(1)}%`);
            console.log(`Total Calls Processed: ${neuromorphicMetrics.totalCalls}`);
            
            console.log('\n=== Photon Processor Stats ===');
            console.log(`Total Photons Processed: ${photonStats.totalPhotonsProcessed}`);
            console.log(`Average Wavelength: ${photonStats.averageWavelength.toFixed(2)}nm`);
            console.log(`Processing Rate: ${photonStats.processingRate.toFixed(2)} photons/sec`);
        }

        await observatory.shutdown();
    }

    async validateConfig(options) {
        try {
            const config = await this.loadConfig(options.config);
            this.logger.info('Configuration is valid');
            console.log('✓ Configuration validation passed');
            
            // Show any warnings
            const warnings = this.getConfigWarnings(config);
            if (warnings.length > 0) {
                console.log('\nWarnings:');
                warnings.forEach(warning => console.log(`  ⚠ ${warning}`));
            }
            
        } catch (error) {
            console.log('✗ Configuration validation failed');
            console.log(`Error: ${error.message}`);
            process.exit(1);
        }
    }

    async showConfig(options) {
        const config = await this.loadConfig(options.config);
        
        // Mask sensitive values
        const masked = this.maskSensitiveConfig(config);
        console.log(JSON.stringify(masked, null, 2));
    }

    async loadConfig(configPath) {
        try {
            const configManager = new ConfigManager({});
            return configManager.loadFromFile(configPath);
        } catch (error) {
            this.logger.warn(`Could not load config file: ${error.message}`);
            return {};
        }
    }

    displayStatusTable(status) {
        console.log('\n=== Lang Observatory Status ===');
        console.log(`Overall Status: ${status.status.toUpperCase()}`);
        
        console.log('\nCore Services:');
        Object.entries(status.services).forEach(([service, serviceStatus]) => {
            const indicator = serviceStatus.healthy ? '✓' : '✗';
            console.log(`  ${indicator} ${service}: ${serviceStatus.healthy ? 'healthy' : 'unhealthy'}`);
        });

        if (status.reliability) {
            console.log('\nReliability:');
            console.log(`  Circuit Breakers: ${status.reliability.overallHealthy ? 'healthy' : 'degraded'}`);
        }

        if (status.performance) {
            console.log('\nPerformance:');
            console.log(`  Current Load: ${(status.performance.metrics.currentLoad * 100).toFixed(1)}%`);
            console.log(`  Auto Scaling: ${status.performance.autoScaling.enabled ? 'enabled' : 'disabled'}`);
        }

        console.log(`\nLast Updated: ${status.timestamp}`);
    }

    getConfigWarnings(config) {
        const warnings = [];
        
        if (!config.langfuse?.publicKey) {
            warnings.push('Langfuse public key not configured');
        }
        
        if (!config.langfuse?.secretKey) {
            warnings.push('Langfuse secret key not configured');
        }
        
        if (!config.database?.host) {
            warnings.push('Database host not configured');
        }
        
        return warnings;
    }

    maskSensitiveConfig(config) {
        const masked = JSON.parse(JSON.stringify(config));
        
        // Mask sensitive keys
        const sensitiveKeys = ['password', 'secret', 'key', 'token', 'auth'];
        
        const maskValue = (obj) => {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    maskValue(obj[key]);
                } else if (typeof obj[key] === 'string') {
                    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                        obj[key] = '***masked***';
                    }
                }
            });
        };
        
        maskValue(masked);
        return masked;
    }

    run() {
        this.program.parse();
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    const cli = new LangObservatoryCLI();
    cli.run();
}

module.exports = { LangObservatoryCLI };