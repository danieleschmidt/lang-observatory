const { execSync } = require('child_process')

describe('End-to-End Tests', () => {
  const testNamespace = 'lang-observatory-test'
  const releaseName = 'lang-observatory-e2e'
  
  beforeAll(async () => {
    try {
      execSync(`kubectl create namespace ${testNamespace} --dry-run=client -o yaml | kubectl apply -f -`, { stdio: 'inherit' })
    } catch (error) {
      console.warn('Warning: Namespace may already exist')
    }
  })

  afterAll(async () => {
    try {
      execSync(`helm uninstall ${releaseName} -n ${testNamespace}`, { stdio: 'inherit' })
      execSync(`kubectl delete namespace ${testNamespace}`, { stdio: 'inherit' })
    } catch (error) {
      console.warn('Warning: Cleanup may have failed')
    }
  })

  test('Chart can be installed in test environment', async () => {
    const chartPath = '../../charts/lang-observatory'
    
    expect(() => {
      execSync(`helm install ${releaseName} ${chartPath} -n ${testNamespace} --wait --timeout=300s`, { 
        stdio: 'inherit',
        cwd: __dirname
      })
    }).not.toThrow()
  }, 300000)

  test('All pods are running', () => {
    const output = execSync(`kubectl get pods -n ${testNamespace} -o json`, { encoding: 'utf8' })
    const pods = JSON.parse(output)
    
    expect(pods.items.length).toBeGreaterThan(0)
    
    pods.items.forEach(pod => {
      expect(pod.status.phase).toBe('Running')
    })
  })

  test('Services are accessible', () => {
    const output = execSync(`kubectl get services -n ${testNamespace} -o json`, { encoding: 'utf8' })
    const services = JSON.parse(output)
    
    expect(services.items.length).toBeGreaterThan(0)
    
    services.items.forEach(service => {
      expect(service.spec.ports.length).toBeGreaterThan(0)
    })
  })

  test('Health checks pass', () => {
    expect(() => {
      execSync(`helm test ${releaseName} -n ${testNamespace}`, { stdio: 'inherit' })
    }).not.toThrow()
  })
})