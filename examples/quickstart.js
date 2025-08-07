/**
 * Photon Neuromorphics SDK - Quick Start Example
 * Demonstrates the revolutionary neuromorphic LLM observability capabilities
 */

const { LangObservatory } = require('../src/index');

async function neuromorphicQuickStart() {
    console.log('🧠 Photon Neuromorphics SDK - Quick Start');
    console.log('🌟 Revolutionary LLM Observability with Quantum-Inspired Computing\n');
    
    try {
        // Initialize the neuromorphic observatory
        console.log('⚡ Initializing Quantum Neuromorphic System...');
        
        const observatory = new LangObservatory({
            photon: {
                maxNeurons: 500,            // Neural network with 500 neurons
                spikeThreshold: 0.7,        // Neural firing threshold
                quantumCoherence: 0.85      // Quantum coherence level
            },
            neuromorphic: {
                realTimeProcessing: false,   // Synchronous for demo
                learningEnabled: true,       // Enable adaptive learning
                quantumEnhancement: true     // Enable quantum features
            },
            cache: {
                maxSize: 1000,              // Cache 1000 entries
                quantumEviction: true       // Quantum eviction strategy
            },
            performance: {
                resourceMonitoring: true,    // Monitor resources
                optimizationInterval: 30000  // Optimize every 30 seconds
            },
            errorHandling: {
                selfHealingEnabled: true,   // Enable self-healing
                maxRetries: 2               // Retry failed operations
            }
        });
        
        await observatory.initialize();
        console.log('✅ Neuromorphic system initialized successfully!\n');
        
        // Demonstrate neuromorphic LLM analysis
        console.log('🔬 Processing LLM calls through neuromorphic pipeline...\n');
        
        // Example 1: High-performance LLM call
        console.log('📊 Example 1: High-Performance OpenAI Call');
        const highPerfResult = await observatory.recordLLMCall(
            'openai',
            'gpt-4',
            { prompt: 'Explain quantum computing in simple terms', tokens: 60 },
            { response: 'Quantum computing uses quantum mechanics principles like superposition and entanglement to process information...', tokens: 120 },
            { 
                duration: 1200,    // Fast response
                cost: 0.036,       // Moderate cost
                quality: 0.95      // High quality
            }
        );
        
        displayNeuromorphicResults('High-Performance', highPerfResult);
        
        // Example 2: Cost-intensive LLM call
        console.log('\n💰 Example 2: Cost-Intensive Anthropic Call');
        const costlyResult = await observatory.recordLLMCall(
            'anthropic',
            'claude-3-opus',
            { prompt: 'Write a detailed analysis of market trends in AI technology', tokens: 200 },
            { response: 'The AI technology market has experienced unprecedented growth...', tokens: 800 },
            {
                duration: 5000,    // Slower response due to complexity
                cost: 0.24,        // High cost
                quality: 0.92      // High quality
            }
        );
        
        displayNeuromorphicResults('Cost-Intensive', costlyResult);
        
        // Example 3: Performance-challenged call
        console.log('\n🐌 Example 3: Performance-Challenged Google Call');
        const slowResult = await observatory.recordLLMCall(
            'google',
            'gemini-pro',
            { prompt: 'Complex mathematical analysis', tokens: 150 },
            { response: 'Mathematical analysis result...', tokens: 300 },
            {
                duration: 8000,    // Very slow
                cost: 0.045,       // Moderate cost
                quality: 0.75      // Lower quality
            }
        );
        
        displayNeuromorphicResults('Performance-Challenged', slowResult);
        
        // Display comprehensive neuromorphic metrics
        console.log('\n📈 Comprehensive Neuromorphic System Metrics');
        console.log('='.repeat(60));
        
        const metrics = await observatory.getNeuromorphicMetrics();
        
        console.log('🧠 Photon Processor Metrics:');
        console.log(`  • Neural Network: ${metrics.photonProcessor.neuronsActive}/${metrics.photonProcessor.totalNeurons || 500} neurons active`);
        console.log(`  • Quantum Coherence: ${(metrics.photonProcessor.quantumCoherence * 100).toFixed(1)}%`);
        console.log(`  • Spikes Processed: ${metrics.photonProcessor.spikesProcessed}`);
        console.log(`  • Photons Emitted: ${metrics.photonProcessor.photonsEmitted}`);
        console.log(`  • Quantum Operations: ${metrics.photonProcessor.quantumOperations}`);
        
        console.log('\n⚡ Performance Optimizer:');
        console.log(`  • Success Rate: ${(metrics.performanceOptimizer.successRate * 100).toFixed(1)}%`);
        console.log(`  • Active Optimizations: ${metrics.performanceOptimizer.activeOptimizations}`);
        console.log(`  • Total Optimizations: ${metrics.performanceOptimizer.totalOptimizations}`);
        
        console.log('\n🗄️ Neuromorphic Cache:');
        console.log(`  • Hit Rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
        console.log(`  • Cache Size: ${metrics.cache.cacheSize} entries`);
        console.log(`  • Quantum Coherence: ${(metrics.cache.avgQuantumCoherence * 100).toFixed(1)}%`);
        console.log(`  • Entanglements: ${metrics.cache.entanglementCount}`);
        
        console.log('\n🛡️ Error Handler:');
        console.log(`  • Error Recovery Rate: ${(metrics.performance.errorRecoveryRate * 100).toFixed(1)}%`);
        console.log(`  • Healing Strategies: ${metrics.errorHandler.healingCapability?.strategiesAvailable || 5} available`);
        console.log(`  • Self-Healing: ${metrics.errorHandler.healingCapability?.enabled ? '✅ Enabled' : '❌ Disabled'}`);
        
        // System health check
        console.log('\n🏥 System Health Status');
        console.log('='.repeat(30));
        
        const health = await observatory.getHealthStatus();
        console.log(`Overall Status: ${getStatusIcon(health.status)} ${health.status.toUpperCase()}`);
        console.log(`Photon Processor: ${getHealthIcon(health.services.photonProcessor?.healthy)} ${health.services.photonProcessor?.healthy ? 'Healthy' : 'Degraded'}`);
        console.log(`Neuromorphic Interface: ${getHealthIcon(health.services.neuromorphicInterface?.healthy)} ${health.services.neuromorphicInterface?.healthy ? 'Healthy' : 'Degraded'}`);
        
        // Provider analysis
        console.log('\n🎯 Provider-Specific Neuromorphic Analysis');
        console.log('='.repeat(50));
        
        const providers = ['openai', 'anthropic', 'google'];
        for (const provider of providers) {
            const analysis = await observatory.getProviderNeuromorphicAnalysis(provider, 5);
            
            console.log(`\n📊 ${provider.toUpperCase()} Analysis:`);
            console.log(`  • Total Insights: ${analysis.insights.length}`);
            console.log(`  • Avg Processing Time: ${analysis.summary.avgProcessingTime?.toFixed(0) || 'N/A'}ms`);
            console.log(`  • Adaptive Score: ${analysis.summary.avgAdaptiveScore?.toFixed(3) || 'N/A'}`);
            console.log(`  • Model Last Updated: ${analysis.adaptiveModel?.lastUpdated ? new Date(analysis.adaptiveModel.lastUpdated).toLocaleTimeString() : 'N/A'}`);
            
            if (analysis.summary.recommendationTypes && Object.keys(analysis.summary.recommendationTypes).length > 0) {
                console.log('  • Recommendation Types:', Object.entries(analysis.summary.recommendationTypes)
                    .map(([type, count]) => `${type}(${count})`).join(', '));
            }
        }
        
        // Final demonstration
        console.log('\n🎉 Neuromorphic Demonstration Complete!');
        console.log('='.repeat(50));
        console.log('🚀 Key Achievements:');
        console.log(`  ✅ Processed ${metrics.interface.totalLLMCalls} LLM calls`);
        console.log(`  ✅ Generated ${metrics.interface.storedInsights} neuromorphic insights`);
        console.log(`  ✅ Maintained ${(metrics.photonProcessor.quantumCoherence * 100).toFixed(1)}% quantum coherence`);
        console.log(`  ✅ Achieved ${(metrics.cache.hitRate * 100).toFixed(1)}% cache hit rate`);
        console.log(`  ✅ Performed ${metrics.photonProcessor.quantumOperations}+ quantum operations`);
        
        console.log('\n🌟 Revolutionary Features Demonstrated:');
        console.log('  🧠 Photonic neural network processing');
        console.log('  ⚛️ Quantum coherence and entanglement');
        console.log('  🔄 Adaptive learning and optimization');
        console.log('  🗄️ Quantum-inspired cache eviction');
        console.log('  🛡️ Self-healing error recovery');
        console.log('  📊 Multi-provider adaptive analytics');
        
        // Graceful shutdown
        console.log('\n🔌 Shutting down neuromorphic system...');
        await observatory.shutdown();
        console.log('✅ Shutdown complete. Thank you for exploring the future of LLM observability!\n');
        
        console.log('🎯 Next Steps:');
        console.log('  📖 Read the full documentation: NEUROMORPHIC_SDK_GUIDE.md');
        console.log('  🔬 Explore advanced features in the examples/ directory');
        console.log('  🚀 Deploy to production with Kubernetes/Helm');
        console.log('  🌐 Visit: https://terragon-labs.github.io/photon-neuromorphics-sdk\n');
        
    } catch (error) {
        console.error('❌ Error in neuromorphic demonstration:', error.message);
        console.log('\n🛠️ Troubleshooting Tips:');
        console.log('  1. Ensure all dependencies are installed (npm install)');
        console.log('  2. Check system resources (memory, CPU)');
        console.log('  3. Review configuration parameters');
        console.log('  4. See NEUROMORPHIC_SDK_GUIDE.md for detailed setup');
    }
}

function displayNeuromorphicResults(title, result) {
    const insights = result.neuromorphicInsights;
    
    console.log(`  Results: ✅ Processed in ${insights.processingTime}ms`);
    
    if (insights.adaptiveRecommendations) {
        const score = insights.adaptiveRecommendations.adaptiveScore;
        console.log(`  Adaptive Score: ${score.overall.toFixed(3)} (${score.grade})`);
        console.log(`  Total Recommendations: ${insights.adaptiveRecommendations.total}`);
        
        if (insights.adaptiveRecommendations.recommendations.length > 0) {
            const topRec = insights.adaptiveRecommendations.recommendations[0];
            console.log(`  Top Recommendation: ${topRec.recommendation} (${topRec.type})`);
        }
    }
    
    if (insights.neuromorphicResult?.insights) {
        const quantum = insights.neuromorphicResult.insights.quantumCorrelations;
        if (quantum) {
            console.log(`  Quantum Correlations: ${quantum.totalCorrelations} total, ${quantum.strongCorrelations} strong`);
        }
    }
}

function getStatusIcon(status) {
    switch (status) {
        case 'healthy': return '🟢';
        case 'degraded': return '🟡';
        case 'unhealthy': return '🔴';
        default: return '⚪';
    }
}

function getHealthIcon(healthy) {
    return healthy ? '✅' : '⚠️';
}

// Run the demonstration
if (require.main === module) {
    neuromorphicQuickStart().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { neuromorphicQuickStart };