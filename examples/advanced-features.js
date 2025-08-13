/**
 * Advanced Features Example for Lang Observatory
 * Demonstrates error recovery, performance optimization, and scaling
 */

const { LangObservatory } = require('../src/index.js');

async function advancedFeaturesExample() {
  console.log('🔬 Lang Observatory Advanced Features Example');
  console.log('===========================================');

  const observatory = new LangObservatory({
    // Enable reliability features
    reliability: {
      circuitBreaker: true,
      retryPolicy: 'exponential',
      maxRetries: 3,
    },
    // Enable performance optimization
    performance: {
      caching: true,
      memoryOptimization: true,
      gcOptimization: true,
    },
    // Enable auto-scaling
    autoScaling: {
      enabled: true,
      targetCPU: 70,
      minInstances: 1,
      maxInstances: 5,
    },
    // Disable external services for example
    langfuse: { enabled: false },
    openlit: { enabled: false },
    metrics: { enabled: false },
  });

  try {
    await observatory.initialize();
    console.log('✅ Observatory initialized with advanced features');

    // Demonstrate error recovery
    console.log('\n🔧 Testing error recovery...');
    try {
      await observatory.trace('failing-operation', async () => {
        throw new Error('Simulated failure');
      });
    } catch (error) {
      console.log('✅ Error handled gracefully:', error.message);
    }

    // Demonstrate performance optimization
    console.log('\n⚡ Testing performance optimization...');
    const startTime = Date.now();
    
    // First call - will be cached
    await observatory.recordLLMCall(
      'openai',
      'gpt-3.5-turbo',
      'Cache test input',
      'Cache test output'
    );

    // Second identical call - should be faster due to caching
    await observatory.recordLLMCall(
      'openai', 
      'gpt-3.5-turbo',
      'Cache test input',
      'Cache test output'
    );

    const duration = Date.now() - startTime;
    console.log('✅ Performance optimization tested, duration:', duration + 'ms');

    // Demonstrate batch processing
    console.log('\n📦 Testing batch processing...');
    const batchTasks = Array.from({ length: 10 }, (_, i) => ({
      id: `batch-task-${i + 1}`,
      name: `Batch task ${i + 1}`,
      estimatedDuration: Math.random() * 60 + 30,
      priority: Math.random(),
    }));

    const batchPlan = await observatory.planTasks(batchTasks, {
      optimizeFor: 'throughput',
      maxConcurrency: 4,
    });

    console.log('✅ Batch processing plan created:', {
      tasks: batchTasks.length,
      phases: batchPlan.quantumPlan.phases.length,
      parallelism: batchPlan.parallelism,
      efficiency: Math.round(batchPlan.efficiency * 100) + '%',
    });

    // Demonstrate concurrent LLM calls
    console.log('\n🔀 Testing concurrent LLM processing...');
    const concurrentCalls = Array.from({ length: 5 }, (_, i) => 
      observatory.recordLLMCall(
        'openai',
        'gpt-4',
        `Concurrent input ${i + 1}`,
        `Response for call ${i + 1}`,
        { requestId: `req-${i + 1}` }
      )
    );

    const results = await Promise.allSettled(concurrentCalls);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log('✅ Concurrent processing:', successful + '/' + results.length + ' successful');

    // Demonstrate metrics and monitoring
    console.log('\n📊 Advanced metrics and monitoring...');
    const detailedHealth = await observatory.getHealthStatus();
    
    console.log('✅ Detailed health status:');
    console.log('   Overall status:', detailedHealth.status);
    console.log('   Reliability metrics:', {
      circuitBreakers: Object.keys(detailedHealth.reliability.circuitBreakers).length,
      overallHealthy: detailedHealth.reliability.overallHealthy,
    });
    console.log('   Performance metrics:', {
      currentLoad: Math.round(detailedHealth.performance.metrics.currentLoad * 100) + '%',
      overallHealthy: detailedHealth.performance.overallHealthy,
    });

    // Demonstrate quantum task execution
    console.log('\n⚛️  Testing quantum task execution...');
    const executionResult = await observatory.executeTask('advanced-test-task', {
      priority: 'high',
      timeout: 30000,
    });
    
    console.log('✅ Quantum task execution:', {
      success: executionResult.success,
      duration: executionResult.duration + 'ms',
      efficiency: 'optimized',
    });

    console.log('\n🎉 Advanced features example completed successfully!');

  } catch (error) {
    console.error('❌ Error in advanced features example:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await observatory.shutdown();
    console.log('✅ Advanced features example shutdown complete');
  }
}

// Run the example
if (require.main === module) {
  advancedFeaturesExample().catch(console.error);
}

module.exports = { advancedFeaturesExample };