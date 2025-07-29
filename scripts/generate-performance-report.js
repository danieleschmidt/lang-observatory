#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/, '');
    const value = process.argv[i + 1];
    args[key] = value;
  }
  return args;
}

function generateReport(results, scenario) {
  const metrics = results.metrics;
  
  const report = {
    scenario,
    timestamp: new Date().toISOString(),
    summary: {
      duration: results.state?.testRunDurationMs / 1000 || 0,
      totalRequests: metrics.http_reqs?.count || 0,
      requestRate: metrics.http_reqs?.rate || 0,
      errorRate: (metrics.http_req_failed?.rate * 100 || 0).toFixed(2),
      dataTransferred: formatBytes(metrics.data_sent?.count + metrics.data_received?.count || 0),
    },
    responseTime: {
      min: metrics.http_req_duration?.min || 0,
      avg: metrics.http_req_duration?.avg || 0,
      med: metrics.http_req_duration?.med || 0,
      max: metrics.http_req_duration?.max || 0,
      p90: metrics.http_req_duration?.['p(90)'] || 0,
      p95: metrics.http_req_duration?.['p(95)'] || 0,
      p99: metrics.http_req_duration?.['p(99)'] || 0,
    },
    thresholds: results.thresholds || {},
  };

  return report;
}

function generateHTML(report) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - ${report.scenario}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007acc; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; font-size: 0.9em; }
        .threshold-pass { color: #28a745; }
        .threshold-fail { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Report: ${report.scenario}</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>

    <h2>Summary</h2>
    <div class="metric-grid">
        <div class="metric-card">
            <div class="metric-value">${report.summary.totalRequests}</div>
            <div class="metric-label">Total Requests</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.summary.requestRate.toFixed(2)}/s</div>
            <div class="metric-label">Request Rate</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.summary.errorRate}%</div>
            <div class="metric-label">Error Rate</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${(report.summary.duration / 60).toFixed(1)}m</div>
            <div class="metric-label">Duration</div>
        </div>
    </div>

    <h2>Response Time Distribution</h2>
    <table>
        <thead>
            <tr>
                <th>Percentile</th>
                <th>Response Time (ms)</th>
            </tr>
        </thead>
        <tbody>
            <tr><td>Minimum</td><td>${report.responseTime.min.toFixed(2)}</td></tr>
            <tr><td>Average</td><td>${report.responseTime.avg.toFixed(2)}</td></tr>
            <tr><td>Median</td><td>${report.responseTime.med.toFixed(2)}</td></tr>
            <tr><td>90th Percentile</td><td>${report.responseTime.p90.toFixed(2)}</td></tr>
            <tr><td>95th Percentile</td><td>${report.responseTime.p95.toFixed(2)}</td></tr>
            <tr><td>99th Percentile</td><td>${report.responseTime.p99.toFixed(2)}</td></tr>
            <tr><td>Maximum</td><td>${report.responseTime.max.toFixed(2)}</td></tr>
        </tbody>
    </table>

    <h2>Threshold Results</h2>
    <table>
        <thead>
            <tr>
                <th>Threshold</th>
                <th>Result</th>
            </tr>
        </thead>
        <tbody>
            ${Object.entries(report.thresholds).map(([key, value]) => `
                <tr>
                    <td>${key}</td>
                    <td class="${value.ok ? 'threshold-pass' : 'threshold-fail'}">
                        ${value.ok ? '✓ PASS' : '✗ FAIL'}
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function main() {
  const args = parseArgs();
  
  if (!args.input || !args.output || !args.scenario) {
    console.error('Usage: node generate-performance-report.js --input <file> --output <file> --scenario <name>');
    process.exit(1);
  }

  try {
    const results = JSON.parse(fs.readFileSync(args.input, 'utf8'));
    const report = generateReport(results, args.scenario);
    const html = generateHTML(report);
    
    fs.writeFileSync(args.output, html);
    console.log(`Performance report generated: ${args.output}`);
    
    // Also output JSON summary
    const jsonOutput = args.output.replace('.html', '.json');
    fs.writeFileSync(jsonOutput, JSON.stringify(report, null, 2));
    console.log(`JSON report generated: ${jsonOutput}`);
    
  } catch (error) {
    console.error('Error generating report:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}