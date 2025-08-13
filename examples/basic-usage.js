/**
 * Basic Usage Example for Lang Observatory
 * Demonstrates core functionality and setup
 */

const { LangObservatory } = require('../src/index.js');

async function basicUsageExample() {
  console.log('🚀 Lang Observatory Basic Usage Example');
  console.log('=====================================');

  // Initialize the observatory
  const observatory = new LangObservatory({
    langfuse: {
      enabled: false, // Disable external services for example
    },
    openlit: {
      enabled: false,
    },
    metrics: {
      enabled: false,
    },
  });

  try {
    // Initialize the observatory
    console.log('📡 Initializing Lang Observatory...');
    await observatory.initialize();
    console.log('✅ Observatory initialized successfully!');

    // Example 1: Record an LLM call
    console.log('\n📝 Recording LLM call...');
    const llmResult = await observatory.recordLLMCall(
      'openai',
      'gpt-4',
      'What is the meaning of life?',
      'The meaning of life is a philosophical question that has been debated for centuries...',
      {
        tokens: 150,
        cost: 0.0045,
        duration: 1200,
      }
    );
    console.log('✅ LLM call recorded:', llmResult.neuromorphicInsights?.adaptiveScore);

    // Example 2: Plan tasks using quantum optimization
    console.log('\n🔄 Planning tasks with quantum optimization...');
    const tasks = [
      { id: 'task1', name: 'Data preprocessing', estimatedDuration: 30 },
      { id: 'task2', name: 'Model training', estimatedDuration: 120, dependencies: ['task1'] },
      { id: 'task3', name: 'Model evaluation', estimatedDuration: 45, dependencies: ['task2'] },
    ];

    const plan = await observatory.planTasks(tasks, {
      maxConcurrency: 2,
      priority: 'speed',
    });
    console.log('✅ Task plan created:', {
      phases: plan.quantumPlan.phases.length,
      efficiency: Math.round(plan.efficiency * 100) + '%',
      duration: plan.totalDuration + 'ms',
    });

    // Example 3: Get health status
    console.log('\n💚 Checking health status...');
    const health = await observatory.getHealthStatus();
    console.log('✅ Health status:', health.status);
    console.log('   Services healthy:', Object.keys(health.services).filter(
      key => health.services[key].healthy
    ).length + '/' + Object.keys(health.services).length);

    // Example 4: Get neuromorphic insights
    console.log('\n🧠 Getting neuromorphic insights...');
    const metrics = await observatory.getNeuromorphicMetrics();
    console.log('✅ Neuromorphic metrics:', {
      totalCalls: metrics.totalProcessedCalls,
      efficiency: Math.round(metrics.processingEfficiency * 100) + '%',
      activeProviders: metrics.activeProviders,
    });

    console.log('\n🎉 Basic usage example completed successfully!');

  } catch (error) {
    console.error('❌ Error in basic usage example:', error.message);
  } finally {
    // Clean shutdown
    console.log('\n🔄 Shutting down...');
    await observatory.shutdown();
    console.log('✅ Shutdown complete');
  }
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

module.exports = { basicUsageExample };