"""
Utility functions and helpers for Lang Observatory tests.
"""

import time
import asyncio
import random
import string
from typing import Dict, Any, List, Optional, Callable
from unittest.mock import Mock
from pathlib import Path
import json
import yaml


class TestDataGenerator:
    """Generate realistic test data for LLM observability testing."""
    
    MODELS = [
        "gpt-4", "gpt-3.5-turbo", "gpt-4-turbo", 
        "claude-3", "claude-3-haiku", "claude-3-sonnet",
        "llama-2-7b", "llama-2-13b", "llama-2-70b",
        "mistral-7b", "mixtral-8x7b"
    ]
    
    PROVIDERS = ["openai", "anthropic", "together", "replicate", "ollama"]
    
    USER_TYPES = ["developer", "analyst", "researcher", "student", "business"]
    
    @classmethod
    def generate_trace_id(cls) -> str:
        """Generate a realistic trace ID."""
        return f"trace_{''.join(random.choices(string.ascii_lowercase + string.digits, k=16))}"
    
    @classmethod
    def generate_user_id(cls) -> str:
        """Generate a realistic user ID."""
        return f"user_{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"
    
    @classmethod
    def generate_trace_data(cls, **overrides) -> Dict[str, Any]:
        """Generate realistic trace data."""
        model = random.choice(cls.MODELS)
        provider = random.choice(cls.PROVIDERS)
        
        # Base token usage
        input_tokens = random.randint(10, 500)
        output_tokens = random.randint(20, 800)
        total_tokens = input_tokens + output_tokens
        
        # Calculate realistic costs based on model
        cost_per_1k_input = cls._get_model_cost(model, "input")
        cost_per_1k_output = cls._get_model_cost(model, "output")
        total_cost = (input_tokens * cost_per_1k_input / 1000) + (output_tokens * cost_per_1k_output / 1000)
        
        base_data = {
            "id": cls.generate_trace_id(),
            "name": f"{model}_generation",
            "user_id": cls.generate_user_id(),
            "session_id": f"session_{''.join(random.choices(string.ascii_lowercase, k=10))}",
            "model": model,
            "provider": provider,
            "metadata": {
                "temperature": round(random.uniform(0.0, 1.0), 2),
                "max_tokens": random.choice([256, 512, 1024, 2048]),
                "top_p": round(random.uniform(0.1, 1.0), 2),
                "frequency_penalty": round(random.uniform(0.0, 2.0), 2),
                "presence_penalty": round(random.uniform(0.0, 2.0), 2),
                "user_type": random.choice(cls.USER_TYPES),
                "environment": random.choice(["development", "staging", "production"]),
            },
            "input": cls._generate_realistic_prompt(),
            "output": cls._generate_realistic_response(),
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
            },
            "cost": round(total_cost, 6),
            "latency_ms": random.randint(500, 5000),
            "timestamp": time.time(),
            "status": random.choices(["success", "error"], weights=[95, 5])[0],
            "error": None if random.random() > 0.05 else cls._generate_error(),
        }
        
        # Apply overrides
        base_data.update(overrides)
        return base_data
    
    @classmethod
    def generate_metrics_data(cls, timestamp: Optional[float] = None) -> Dict[str, Any]:
        """Generate realistic metrics data."""
        if timestamp is None:
            timestamp = time.time()
            
        return {
            "timestamp": timestamp,
            "metrics": {
                "llm_requests_total": random.randint(50, 1000),
                "llm_request_duration_seconds": {
                    "count": random.randint(50, 1000),
                    "sum": round(random.uniform(50.0, 500.0), 2),
                    "buckets": {
                        "0.1": random.randint(0, 10),
                        "0.5": random.randint(10, 50),
                        "1.0": random.randint(50, 150),
                        "2.0": random.randint(150, 300),
                        "5.0": random.randint(300, 500),
                        "+Inf": random.randint(500, 1000),
                    },
                },
                "llm_tokens_total": {
                    "input": random.randint(5000, 50000),
                    "output": random.randint(7500, 75000),
                },
                "llm_cost_total": round(random.uniform(1.0, 100.0), 2),
                "llm_errors_total": random.randint(0, 50),
                "llm_cache_hits_total": random.randint(10, 200),
                "llm_cache_misses_total": random.randint(100, 800),
            },
            "labels": {
                "model": random.choice(cls.MODELS),
                "provider": random.choice(cls.PROVIDERS),
                "environment": random.choice(["development", "staging", "production"]),
            }
        }
    
    @classmethod
    def _get_model_cost(cls, model: str, token_type: str) -> float:
        """Get realistic cost per 1K tokens for a model."""
        cost_table = {
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-3.5-turbo": {"input": 0.001, "output": 0.002},
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "claude-3": {"input": 0.015, "output": 0.075},
            "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
            "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            "llama-2-7b": {"input": 0.0002, "output": 0.0002},
            "llama-2-13b": {"input": 0.0003, "output": 0.0003},
            "llama-2-70b": {"input": 0.0008, "output": 0.0008},
            "mistral-7b": {"input": 0.0002, "output": 0.0002},
            "mixtral-8x7b": {"input": 0.0006, "output": 0.0006},
        }
        return cost_table.get(model, {"input": 0.001, "output": 0.002})[token_type]
    
    @classmethod
    def _generate_realistic_prompt(cls) -> str:
        """Generate realistic prompt text."""
        prompts = [
            "Explain the concept of quantum computing in simple terms.",
            "Write a Python function to calculate the Fibonacci sequence.",
            "What are the benefits of using Kubernetes for container orchestration?",
            "Summarize the key points from this research paper about machine learning.",
            "Generate a creative story about a robot learning to paint.",
            "Help me debug this SQL query that's running slowly.",
            "Translate this text from English to Spanish.",
            "What are the best practices for API design?",
            "Create a marketing plan for a new SaaS product.",
            "Explain the differences between supervised and unsupervised learning.",
        ]
        return random.choice(prompts)
    
    @classmethod
    def _generate_realistic_response(cls) -> str:
        """Generate realistic response text."""
        responses = [
            "Here's a comprehensive explanation of the concept...",
            "I'll help you create that function. Here's the implementation...",
            "Kubernetes offers several key benefits for container orchestration...",
            "Based on the research paper, the main findings are...",
            "Once upon a time, in a small workshop, there lived a robot named Pixel...",
            "Looking at your SQL query, I can see a few optimization opportunities...",
            "Here's the Spanish translation of the provided text...",
            "When designing APIs, it's important to follow these best practices...",
            "Here's a comprehensive marketing plan for your SaaS product...",
            "The main differences between supervised and unsupervised learning are...",
        ]
        return random.choice(responses)
    
    @classmethod
    def _generate_error(cls) -> Dict[str, Any]:
        """Generate realistic error data."""
        errors = [
            {"type": "RateLimitError", "message": "API rate limit exceeded"},
            {"type": "InvalidRequestError", "message": "Invalid parameter: temperature must be between 0 and 2"},
            {"type": "AuthenticationError", "message": "Invalid API key"},
            {"type": "ServiceUnavailableError", "message": "Service temporarily unavailable"},
            {"type": "TimeoutError", "message": "Request timed out after 30 seconds"},
        ]
        error = random.choice(errors)
        return {
            "error_type": error["type"],
            "error_message": error["message"],
            "error_code": random.randint(400, 599),
            "retry_after": random.randint(1, 300) if "Rate" in error["type"] else None,
        }


class ServiceWaiter:
    """Utility for waiting for services to be ready."""
    
    @staticmethod
    async def wait_for_service(
        check_function: Callable[[], bool],
        timeout: int = 60,
        interval: float = 1.0,
        service_name: str = "service"
    ) -> bool:
        """Wait for a service to be ready."""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                if check_function():
                    return True
            except Exception:
                pass
            
            await asyncio.sleep(interval)
        
        raise TimeoutError(f"{service_name} did not become ready within {timeout} seconds")
    
    @staticmethod
    async def wait_for_http_service(url: str, timeout: int = 60, service_name: str = None) -> bool:
        """Wait for HTTP service to respond."""
        import aiohttp
        
        if service_name is None:
            service_name = url
        
        async def check_http():
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                        return response.status < 500
                except:
                    return False
        
        return await ServiceWaiter.wait_for_service(check_http, timeout, service_name=service_name)


class MockFactory:
    """Factory for creating consistent mocks across tests."""
    
    @staticmethod
    def create_langfuse_mock() -> Mock:
        """Create a mock Langfuse client."""
        mock_client = Mock()
        mock_trace = Mock()
        mock_generation = Mock()
        mock_span = Mock()
        
        # Configure trace mock
        mock_trace.id = TestDataGenerator.generate_trace_id()
        mock_trace.generation.return_value = mock_generation
        mock_trace.span.return_value = mock_span
        
        # Configure generation mock
        mock_generation.id = f"gen_{''.join(random.choices(string.ascii_lowercase, k=12))}"
        
        # Configure span mock
        mock_span.id = f"span_{''.join(random.choices(string.ascii_lowercase, k=12))}"
        
        # Configure client mock
        mock_client.trace.return_value = mock_trace
        mock_client.flush.return_value = True
        
        return mock_client
    
    @staticmethod
    def create_prometheus_mock() -> Mock:
        """Create a mock Prometheus client."""
        mock_client = Mock()
        
        # Mock query methods
        mock_client.query.return_value = {
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": []
            }
        }
        
        mock_client.query_range.return_value = {
            "status": "success", 
            "data": {
                "resultType": "matrix",
                "result": []
            }
        }
        
        return mock_client


class FileHelper:
    """Helper functions for file operations in tests."""
    
    @staticmethod
    def load_test_data(filename: str, data_type: str = "json") -> Any:
        """Load test data from file."""
        file_path = Path(__file__).parent / "fixtures" / filename
        
        with open(file_path, 'r', encoding='utf-8') as f:
            if data_type == "json":
                return json.load(f)
            elif data_type == "yaml":
                return yaml.safe_load(f)
            else:
                return f.read()
    
    @staticmethod
    def save_test_data(filename: str, data: Any, data_type: str = "json") -> Path:
        """Save test data to file."""
        file_path = Path(__file__).parent / "fixtures" / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            if data_type == "json":
                json.dump(data, f, indent=2)
            elif data_type == "yaml":
                yaml.dump(data, f, default_flow_style=False)
            else:
                f.write(str(data))
        
        return file_path


class AssertionHelper:
    """Custom assertion helpers for LLM observability testing."""
    
    @staticmethod
    def assert_valid_trace(trace_data: Dict[str, Any]) -> None:
        """Assert that trace data has valid structure."""
        required_fields = ["id", "name", "timestamp", "status"]
        for field in required_fields:
            assert field in trace_data, f"Missing required field: {field}"
        
        # Validate timestamp
        assert isinstance(trace_data["timestamp"], (int, float))
        assert trace_data["timestamp"] > 0
        
        # Validate status
        assert trace_data["status"] in ["success", "error", "pending"]
        
        # Validate usage if present
        if "usage" in trace_data:
            usage = trace_data["usage"]
            assert "total_tokens" in usage
            assert usage["total_tokens"] >= 0
    
    @staticmethod
    def assert_valid_metrics(metrics_data: Dict[str, Any]) -> None:
        """Assert that metrics data has valid structure."""
        assert "timestamp" in metrics_data
        assert "metrics" in metrics_data
        
        metrics = metrics_data["metrics"]
        
        # Check for expected metric types
        if "llm_requests_total" in metrics:
            assert isinstance(metrics["llm_requests_total"], int)
            assert metrics["llm_requests_total"] >= 0
        
        if "llm_cost_total" in metrics:
            assert isinstance(metrics["llm_cost_total"], (int, float))
            assert metrics["llm_cost_total"] >= 0
    
    @staticmethod
    def assert_performance_within_bounds(
        duration: float, 
        max_duration: float, 
        operation: str = "operation"
    ) -> None:
        """Assert that an operation completed within performance bounds."""
        assert duration <= max_duration, (
            f"{operation} took {duration:.3f}s, expected <= {max_duration}s"
        )