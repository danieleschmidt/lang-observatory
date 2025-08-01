"""
Pytest configuration and shared fixtures for Lang Observatory tests.
"""

import os
import pytest
import asyncio
import tempfile
import time
from typing import Generator, Any, Dict
from unittest.mock import Mock, patch
from pathlib import Path

# Test environment setup
os.environ.setdefault("NODE_ENV", "test")
os.environ.setdefault("LOG_LEVEL", "DEBUG")
os.environ.setdefault("TESTING", "true")


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def test_config() -> Dict[str, Any]:
    """Provide test configuration."""
    return {
        "langfuse": {
            "host": "http://localhost:3000",
            "public_key": "pk-lf-test-key",
            "secret_key": "sk-lf-test-key",
        },
        "openlit": {
            "endpoint": "http://localhost:4317",
            "api_key": "test-api-key",
        },
        "prometheus": {
            "url": "http://localhost:9090",
        },
        "grafana": {
            "url": "http://localhost:3001",
            "admin_user": "admin",
            "admin_password": "admin",
        },
        "database": {
            "url": "postgresql://test:test@localhost:5433/langfuse_test",
        },
    }


@pytest.fixture
def mock_langfuse_client():
    """Mock Langfuse client for testing."""
    with patch("langfuse.Langfuse") as mock_client:
        mock_instance = Mock()
        mock_client.return_value = mock_instance
        
        # Mock common methods
        mock_instance.trace.return_value.generation.return_value = Mock(id="test-generation-id")
        mock_instance.trace.return_value.span.return_value = Mock(id="test-span-id")
        mock_instance.flush.return_value = True
        
        yield mock_instance


@pytest.fixture
def mock_openlit():
    """Mock OpenLIT instrumentation."""
    with patch("openlit.init") as mock_init:
        mock_init.return_value = True
        yield mock_init


@pytest.fixture
def temp_directory() -> Generator[Path, None, None]:
    """Provide temporary directory for tests."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
def sample_trace_data() -> Dict[str, Any]:
    """Provide sample trace data for testing."""
    return {
        "id": "test-trace-123",
        "name": "llm_call",
        "user_id": "user-456",
        "metadata": {
            "model": "gpt-4",
            "temperature": 0.7,
            "max_tokens": 256,
        },
        "input": "What is the weather like today?",
        "output": "I don't have access to real-time weather data.",
        "usage": {
            "input_tokens": 8,
            "output_tokens": 12,
            "total_tokens": 20,
        },
        "cost": 0.001,
        "latency_ms": 1250,
        "timestamp": "2025-01-28T10:30:00Z",
    }


@pytest.fixture
def sample_metrics_data() -> Dict[str, Any]:
    """Provide sample metrics data for testing."""
    return {
        "timestamp": int(time.time()),
        "metrics": {
            "llm_requests_total": 100,
            "llm_request_duration_seconds": {
                "count": 100,
                "sum": 125.5,
                "buckets": {
                    "0.1": 10,
                    "0.5": 45,
                    "1.0": 75,
                    "2.0": 95,
                    "5.0": 100,
                },
            },
            "llm_tokens_total": {
                "input": 5000,
                "output": 7500,
                "total": 12500,
            },
            "llm_cost_total": 12.50,
            "llm_errors_total": 2,
        },
    }


@pytest.fixture
def mock_kubernetes_client():
    """Mock Kubernetes client for testing."""
    with patch("kubernetes.client.ApiClient") as mock_client:
        mock_instance = Mock()
        mock_client.return_value = mock_instance
        
        # Mock common API operations
        mock_instance.list_namespaced_pod.return_value.items = []
        mock_instance.list_namespaced_service.return_value.items = []
        mock_instance.list_namespaced_deployment.return_value.items = []
        
        yield mock_instance


@pytest.fixture
def mock_prometheus_client():
    """Mock Prometheus client for testing."""
    with patch("prometheus_client.CollectorRegistry") as mock_registry:
        mock_instance = Mock()
        mock_registry.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_docker_client():
    """Mock Docker client for testing."""
    with patch("docker.from_env") as mock_docker:
        mock_client = Mock()
        mock_docker.return_value = mock_client
        
        # Mock container operations
        mock_client.containers.list.return_value = []
        mock_client.containers.run.return_value = Mock(id="test-container-id")
        
        yield mock_client


@pytest.fixture(scope="function")
def reset_environment():
    """Reset environment variables after each test."""
    original_env = os.environ.copy()
    yield
    os.environ.clear()
    os.environ.update(original_env)


# Pytest hooks for custom behavior
def pytest_configure(config):
    """Configure pytest with custom settings."""
    # Add custom markers
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "e2e: End-to-end tests")
    config.addinivalue_line("markers", "performance: Performance tests")
    config.addinivalue_line("markers", "slow: Slow tests")
    config.addinivalue_line("markers", "security: Security tests")
    config.addinivalue_line("markers", "llm: LLM-specific tests")
    config.addinivalue_line("markers", "observability: Observability tests")


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers based on path."""
    for item in items:
        # Add markers based on test file path
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
        elif "performance" in str(item.fspath):
            item.add_marker(pytest.mark.performance)
            item.add_marker(pytest.mark.slow)


@pytest.fixture(autouse=True)
def setup_test_logging(caplog):
    """Setup logging for all tests."""
    import logging
    
    # Set log level for testing
    logging.getLogger().setLevel(logging.DEBUG)
    
    # Create logs directory if it doesn't exist
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)


# Performance testing utilities
@pytest.fixture
def performance_timer():
    """Utility for timing operations in performance tests."""
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            
        def start(self):
            self.start_time = time.time()
            
        def stop(self):
            self.end_time = time.time()
            
        @property
        def elapsed(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
            
    return Timer()


# Database testing utilities
@pytest.fixture
async def test_database():
    """Provide isolated test database."""
    # This would typically set up a test database
    # For now, we'll mock it
    mock_db = Mock()
    mock_db.connect.return_value = True
    mock_db.close.return_value = True
    yield mock_db