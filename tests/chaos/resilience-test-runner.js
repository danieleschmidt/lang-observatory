#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ResilienceTestRunner {
  constructor() {
    this.namespace = process.env.CHAOS_NAMESPACE || 'lang-observatory';
    this.experiments = [
      {
        name: 'network-latency',
        description: 'Tests system behavior under network latency',
        duration: 120, // seconds
        acceptable_degradation: 0.1, // 10% performance degradation acceptable
      },
      {
        name: 'pod-delete',
        description: 'Tests system recovery from pod failures',
        duration: 60,
        acceptable_degradation: 0.05, // 5% degradation acceptable
      },
      {
        name: 'container-kill',
        description: 'Tests container restart resilience',
        duration: 40,
        acceptable_degradation: 0.05,
      },
    ];
    this.results = [];
  }

  async runExperiment(experiment) {
    console.log(`🧪 Starting chaos experiment: ${experiment.name}`);
    console.log(`   Description: ${experiment.description}`);

    const startTime = Date.now();

    // Capture baseline metrics
    const baselineMetrics = await this.captureMetrics();
    console.log(`📊 Baseline metrics captured`);

    try {
      // Apply chaos experiment
      await this.executeCommand(
        `kubectl apply -f tests/chaos/${experiment.name}.yaml -n ${this.namespace}`
      );

      // Wait for experiment duration
      console.log(
        `⏱️  Running experiment for ${experiment.duration} seconds...`
      );
      await this.sleep(experiment.duration * 1000);

      // Capture post-chaos metrics
      const chaosMetrics = await this.captureMetrics();
      console.log(`📊 Chaos metrics captured`);

      // Cleanup experiment
      await this.executeCommand(
        `kubectl delete -f tests/chaos/${experiment.name}.yaml -n ${this.namespace}`
      );

      // Wait for system to stabilize
      console.log(`🔄 Waiting for system to stabilize...`);
      await this.sleep(30000); // 30 seconds

      // Capture recovery metrics
      const recoveryMetrics = await this.captureMetrics();
      console.log(`📊 Recovery metrics captured`);

      // Analyze results
      const analysis = this.analyzeResults(
        baselineMetrics,
        chaosMetrics,
        recoveryMetrics,
        experiment
      );

      const result = {
        experiment: experiment.name,
        description: experiment.description,
        duration: experiment.duration,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        baseline: baselineMetrics,
        chaos: chaosMetrics,
        recovery: recoveryMetrics,
        analysis,
        passed: analysis.degradation <= experiment.acceptable_degradation,
      };

      this.results.push(result);

      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(
        `${status} ${experiment.name}: ${(analysis.degradation * 100).toFixed(1)}% degradation`
      );

      return result;
    } catch (error) {
      console.error(`❌ Experiment ${experiment.name} failed:`, error.message);

      // Cleanup on error
      try {
        await this.executeCommand(
          `kubectl delete -f tests/chaos/${experiment.name}.yaml -n ${this.namespace}`
        );
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError.message);
      }

      throw error;
    }
  }

  async captureMetrics() {
    // Capture key system metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      responseTime: await this.measureResponseTime(),
      errorRate: await this.measureErrorRate(),
      availability: await this.checkAvailability(),
      resourceUsage: await this.measureResourceUsage(),
    };

    return metrics;
  }

  async measureResponseTime() {
    try {
      const start = Date.now();
      await this.executeCommand(
        `kubectl get pods -n ${this.namespace} --timeout=10s`
      );
      return Date.now() - start;
    } catch (error) {
      return 999999; // High value to indicate failure
    }
  }

  async measureErrorRate() {
    // This would normally query Prometheus endpoint for actual error rate
    // const prometheusQuery = 'sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m]))';
    return 0.01; // Placeholder - 1% error rate
  }

  async checkAvailability() {
    try {
      const result = await this.executeCommand(
        `kubectl get pods -n ${this.namespace} -o json`
      );
      const pods = JSON.parse(result);

      const totalPods = pods.items.length;
      const readyPods = pods.items.filter(pod =>
        pod.status.conditions?.some(
          condition => condition.type === 'Ready' && condition.status === 'True'
        )
      ).length;

      return totalPods > 0 ? readyPods / totalPods : 0;
    } catch (error) {
      return 0;
    }
  }

  async measureResourceUsage() {
    try {
      const result = await this.executeCommand(
        `kubectl top pods -n ${this.namespace} --no-headers`
      );
      const lines = result.trim().split('\n');

      let totalCpu = 0;
      let totalMemory = 0;

      lines.forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          // Parse CPU (e.g., "50m" -> 50)
          const cpu = parseInt(parts[1].replace('m', '')) || 0;
          // Parse Memory (e.g., "128Mi" -> 128)
          const memory = parseInt(parts[2].replace(/Mi|Gi/, '')) || 0;

          totalCpu += cpu;
          totalMemory += memory;
        }
      });

      return { cpu: totalCpu, memory: totalMemory };
    } catch (error) {
      return { cpu: 0, memory: 0 };
    }
  }

  analyzeResults(baseline, chaos, recovery, experiment) {
    const responseTimeDegradation =
      (chaos.responseTime - baseline.responseTime) / baseline.responseTime;
    const errorRateIncrease = chaos.errorRate - baseline.errorRate;
    const availabilityDrop = baseline.availability - chaos.availability;

    const overallDegradation = Math.max(
      responseTimeDegradation,
      errorRateIncrease,
      availabilityDrop
    );

    const recoveryTime =
      new Date(recovery.timestamp) - new Date(chaos.timestamp);
    const recoveredToBaseline =
      Math.abs(recovery.responseTime - baseline.responseTime) <
      baseline.responseTime * 0.1;

    return {
      degradation: overallDegradation,
      responseTimeDegradation,
      errorRateIncrease,
      availabilityDrop,
      recoveryTime: recoveryTime / 1000, // seconds
      recoveredToBaseline,
      recommendation: this.generateRecommendation(
        overallDegradation,
        experiment.acceptable_degradation
      ),
    };
  }

  generateRecommendation(actualDegradation, acceptableDegradation) {
    if (actualDegradation <= acceptableDegradation) {
      return 'System showed good resilience. No immediate action required.';
    } else if (actualDegradation <= acceptableDegradation * 2) {
      return 'System showed moderate degradation. Consider reviewing resource limits and replica counts.';
    } else {
      return 'System showed significant degradation. Urgent review of architecture and resilience patterns required.';
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Command failed: ${command}\nError: ${error.message}\nStderr: ${stderr}`
            )
          );
        } else {
          resolve(stdout);
        }
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllExperiments() {
    console.log('🚀 Starting Lang Observatory Resilience Testing');
    console.log(`📍 Namespace: ${this.namespace}`);
    console.log(`🧪 Experiments: ${this.experiments.length}\n`);

    for (const experiment of this.experiments) {
      try {
        await this.runExperiment(experiment);
        console.log(''); // Add spacing between experiments
      } catch (error) {
        console.error(
          `Skipping remaining experiments due to error in ${experiment.name}`
        );
        break;
      }
    }

    this.generateReport();
  }

  generateReport() {
    const timestamp = new Date().toISOString();
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    const report = {
      timestamp,
      summary: {
        total,
        passed,
        failed: total - passed,
        passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : 0,
      },
      results: this.results,
    };

    // Write detailed JSON report
    fs.writeFileSync(
      'resilience-test-results.json',
      JSON.stringify(report, null, 2)
    );

    // Write summary report
    const summaryReport = `# Resilience Test Report

Generated: ${timestamp}

## Summary
- **Total Experiments**: ${total}
- **Passed**: ${passed}
- **Failed**: ${total - passed}
- **Pass Rate**: ${report.summary.passRate}%

## Results

${this.results
  .map(
    result => `
### ${result.experiment}
- **Status**: ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- **Degradation**: ${(result.analysis.degradation * 100).toFixed(1)}%
- **Recovery Time**: ${result.analysis.recoveryTime}s
- **Recommendation**: ${result.analysis.recommendation}
`
  )
  .join('\n')}

## Recommendations

${this.generateOverallRecommendations()}
`;

    fs.writeFileSync('resilience-test-summary.md', summaryReport);

    console.log('📊 Resilience Testing Complete');
    console.log(
      `📈 Pass Rate: ${report.summary.passRate}% (${passed}/${total})`
    );
    console.log('📄 Reports generated:');
    console.log('   - resilience-test-results.json (detailed)');
    console.log('   - resilience-test-summary.md (summary)');
  }

  generateOverallRecommendations() {
    const failed = this.results.filter(r => !r.passed);

    if (failed.length === 0) {
      return 'System demonstrates excellent resilience across all tested scenarios. Continue monitoring and consider expanding chaos experiments.';
    }

    const recommendations = [
      'Consider implementing circuit breakers for external dependencies',
      'Review and potentially increase resource limits and requests',
      'Implement health checks and readiness probes',
      'Consider implementing retry mechanisms with exponential backoff',
      'Review monitoring and alerting thresholds',
    ];

    return recommendations.join('\n- ');
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new ResilienceTestRunner();
  runner.runAllExperiments().catch(error => {
    console.error('❌ Resilience testing failed:', error.message);
    process.exit(1);
  });
}

module.exports = ResilienceTestRunner;
