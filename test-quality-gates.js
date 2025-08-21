#!/usr/bin/env node

/**
 * Quality Gates Test Runner
 * Executes comprehensive quality validation
 */

const {
  QualityGatesValidator,
} = require('./src/testing/qualityGatesValidator');

async function runQualityGates() {
  console.log('🧪 Starting Comprehensive Quality Gates Validation...\n');

  const validator = new QualityGatesValidator({
    strictMode: true,
    includePerformance: true,
    generateReport: true,
  });

  try {
    const report = await validator.generateQualityReport();

    console.log('📊 QUALITY GATES REPORT');
    console.log('='.repeat(50));
    console.log(
      `Overall Score: ${report.summary.overallScore.toFixed(2)}/100 (${report.summary.grade})`
    );
    console.log(`Status: ${report.summary.status}`);
    console.log(
      `Deployment Ready: ${report.deployment.ready ? '✅ YES' : '❌ NO'}`
    );
    console.log();

    // Display gate results
    console.log('📋 QUALITY GATE RESULTS');
    console.log('-'.repeat(50));

    Object.entries(report.summary.gateResults).forEach(([, result]) => {
      const status = result.passed ? '✅' : '❌';
      const required = result.required ? '[REQUIRED]' : '[OPTIONAL]';
      console.log(
        `${status} ${result.name} ${required}: ${result.score || 0}/${result.threshold || 'N/A'}`
      );
    });

    console.log();

    // Display metrics
    console.log('📈 QUALITY METRICS');
    console.log('-'.repeat(50));
    console.log(`Code Coverage: ${report.metrics.codeCoverage.toFixed(1)}%`);
    console.log(`Test Pass Rate: ${report.metrics.testPassRate.toFixed(1)}%`);
    console.log(`Security Score: ${report.metrics.securityScore.toFixed(1)}%`);
    console.log(
      `Performance Score: ${report.metrics.performanceScore.toFixed(1)}%`
    );
    console.log(
      `Code Quality Score: ${report.metrics.codeQualityScore.toFixed(1)}%`
    );
    console.log();

    // Display recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS');
      console.log('-'.repeat(50));
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
      console.log();
    }

    // Display action plan
    if (report.actionPlan.length > 0) {
      console.log('🎯 ACTION PLAN');
      console.log('-'.repeat(50));
      report.actionPlan.forEach((action, i) => {
        const priority = action.priority.toUpperCase();
        console.log(`${i + 1}. [${priority}] ${action.action}`);
        if (action.currentScore !== undefined) {
          console.log(
            `   Current: ${action.currentScore} → Target: ${action.targetScore}`
          );
        }
      });
      console.log();
    }

    // Display deployment blockers
    if (report.deployment.blockers.length > 0) {
      console.log('🚫 DEPLOYMENT BLOCKERS');
      console.log('-'.repeat(50));
      report.deployment.blockers.forEach((blocker, i) => {
        console.log(
          `${i + 1}. [${blocker.severity.toUpperCase()}] ${blocker.issue}`
        );
      });
      console.log();
    }

    console.log('✅ Quality Gates validation completed successfully!');
    console.log(`Report generated at: ${new Date().toISOString()}`);

    // Set exit code based on deployment readiness
    process.exit(report.deployment.ready ? 0 : 1);
  } catch (error) {
    console.error('❌ Quality Gates validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runQualityGates();
}

module.exports = { runQualityGates };
