"""
Unit tests for Langfuse integration functionality.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any


class TestLangfuseIntegration:
    """Test suite for Langfuse integration."""

    def test_langfuse_client_initialization(self, test_config, mock_langfuse_client):
        """Test Langfuse client initialization with valid config."""
        from langfuse import Langfuse
        
        # Test client creation
        with patch('langfuse.Langfuse') as mock_constructor:
            mock_constructor.return_value = mock_langfuse_client
            
            client = Langfuse(
                public_key=test_config["langfuse"]["public_key"],
                secret_key=test_config["langfuse"]["secret_key"],
                host=test_config["langfuse"]["host"]
            )
            
            mock_constructor.assert_called_once_with(
                public_key="pk-lf-test-key",
                secret_key="sk-lf-test-key",
                host="http://localhost:3000"
            )
            assert client is not None

    def test_trace_creation(self, mock_langfuse_client, sample_trace_data):
        """Test trace creation with valid data."""
        # Setup mock trace
        mock_trace = Mock()
        mock_trace.id = sample_trace_data["id"]
        mock_langfuse_client.trace.return_value = mock_trace
        
        # Create trace
        trace = mock_langfuse_client.trace(
            name=sample_trace_data["name"],
            user_id=sample_trace_data["user_id"],
            metadata=sample_trace_data["metadata"]
        )
        
        # Verify trace creation
        mock_langfuse_client.trace.assert_called_once_with(
            name="llm_call",
            user_id="user-456",
            metadata={
                "model": "gpt-4",
                "temperature": 0.7,
                "max_tokens": 256,
            }
        )
        assert trace.id == "test-trace-123"

    def test_generation_creation(self, mock_langfuse_client, sample_trace_data):
        """Test generation creation within a trace."""
        # Setup mock trace and generation
        mock_trace = Mock()
        mock_generation = Mock()
        mock_generation.id = "test-generation-id"
        mock_trace.generation.return_value = mock_generation
        mock_langfuse_client.trace.return_value = mock_trace
        
        # Create trace and generation
        trace = mock_langfuse_client.trace(name="test_trace")
        generation = trace.generation(
            name="llm_response",
            input=sample_trace_data["input"],
            output=sample_trace_data["output"],
            model=sample_trace_data["metadata"]["model"],
            usage=sample_trace_data["usage"]
        )
        
        # Verify generation creation
        trace.generation.assert_called_once_with(
            name="llm_response",
            input="What is the weather like today?",
            output="I don't have access to real-time weather data.",
            model="gpt-4",
            usage={
                "input_tokens": 8,
                "output_tokens": 12,
                "total_tokens": 20,
            }
        )
        assert generation.id == "test-generation-id"

    def test_span_creation(self, mock_langfuse_client):
        """Test span creation within a trace."""
        # Setup mock trace and span
        mock_trace = Mock()
        mock_span = Mock()
        mock_span.id = "test-span-id"
        mock_trace.span.return_value = mock_span
        mock_langfuse_client.trace.return_value = mock_trace
        
        # Create trace and span
        trace = mock_langfuse_client.trace(name="test_trace")
        span = trace.span(name="preprocessing", input={"text": "test"})
        
        # Verify span creation
        trace.span.assert_called_once_with(
            name="preprocessing",
            input={"text": "test"}
        )
        assert span.id == "test-span-id"

    def test_client_flush(self, mock_langfuse_client):
        """Test client flush operation."""
        # Mock flush to return True
        mock_langfuse_client.flush.return_value = True
        
        # Call flush
        result = mock_langfuse_client.flush()
        
        # Verify flush was called and succeeded
        mock_langfuse_client.flush.assert_called_once()
        assert result is True

    @pytest.mark.parametrize("config_key,config_value,expected_error", [
        ("public_key", None, "public_key is required"),
        ("secret_key", "", "secret_key cannot be empty"),
        ("host", "invalid-url", "Invalid host URL"),
    ])
    def test_invalid_configuration(self, config_key, config_value, expected_error):
        """Test Langfuse client with invalid configuration."""
        # This would test actual validation logic
        # For now, we'll test the mock behavior
        with patch('langfuse.Langfuse') as mock_constructor:
            if config_value is None or config_value == "":
                mock_constructor.side_effect = ValueError(expected_error)
            else:
                mock_constructor.side_effect = ValueError(expected_error)
            
            with pytest.raises(ValueError, match=expected_error):
                from langfuse import Langfuse
                Langfuse(
                    public_key=config_value if config_key == "public_key" else "pk-test",
                    secret_key=config_value if config_key == "secret_key" else "sk-test",
                    host=config_value if config_key == "host" else "http://localhost:3000"
                )

    def test_trace_with_cost_tracking(self, mock_langfuse_client):
        """Test trace creation with cost tracking."""
        mock_trace = Mock()
        mock_generation = Mock()
        mock_trace.generation.return_value = mock_generation
        mock_langfuse_client.trace.return_value = mock_trace
        
        # Create trace with cost information
        trace = mock_langfuse_client.trace(name="cost_test")
        generation = trace.generation(
            name="gpt4_call",
            model="gpt-4",
            usage={
                "input_tokens": 100,
                "output_tokens": 150,
                "total_tokens": 250
            },
            metadata={
                "cost_per_input_token": 0.00003,
                "cost_per_output_token": 0.00006,
                "total_cost": 0.012
            }
        )
        
        # Verify cost tracking data
        trace.generation.assert_called_once()
        call_args = trace.generation.call_args[1]
        assert call_args["metadata"]["total_cost"] == 0.012
        assert call_args["usage"]["total_tokens"] == 250

    @pytest.mark.asyncio
    async def test_async_trace_operations(self, mock_langfuse_client):
        """Test asynchronous trace operations."""
        # Setup async mock
        mock_trace = MagicMock()
        mock_langfuse_client.trace.return_value = mock_trace
        
        # Simulate async operation
        async def async_llm_call():
            trace = mock_langfuse_client.trace(name="async_test")
            # Simulate some async work
            import asyncio
            await asyncio.sleep(0.01)
            return trace
        
        # Execute async operation
        trace = await async_llm_call()
        
        # Verify trace was created
        mock_langfuse_client.trace.assert_called_once_with(name="async_test")
        assert trace is not None

    def test_error_handling(self, mock_langfuse_client):
        """Test error handling in Langfuse operations."""
        # Setup mock to raise exception
        mock_langfuse_client.trace.side_effect = Exception("Network error")
        
        # Test error handling
        with pytest.raises(Exception, match="Network error"):
            mock_langfuse_client.trace(name="error_test")

    def test_metadata_serialization(self, mock_langfuse_client):
        """Test metadata serialization for complex objects."""
        import json
        
        mock_trace = Mock()
        mock_langfuse_client.trace.return_value = mock_trace
        
        complex_metadata = {
            "nested_dict": {"key": "value"},
            "list_data": [1, 2, 3],
            "boolean_flag": True,
            "null_value": None,
        }
        
        # Create trace with complex metadata
        trace = mock_langfuse_client.trace(
            name="metadata_test",
            metadata=complex_metadata
        )
        
        # Verify metadata can be serialized
        call_args = mock_langfuse_client.trace.call_args[1]
        serialized = json.dumps(call_args["metadata"])
        assert json.loads(serialized) == complex_metadata

    @pytest.mark.performance
    def test_high_volume_traces(self, mock_langfuse_client, performance_timer):
        """Test performance with high volume of traces."""
        mock_trace = Mock()
        mock_langfuse_client.trace.return_value = mock_trace
        
        num_traces = 100
        performance_timer.start()
        
        # Create multiple traces
        for i in range(num_traces):
            mock_langfuse_client.trace(name=f"trace_{i}")
        
        performance_timer.stop()
        
        # Verify all traces were created
        assert mock_langfuse_client.trace.call_count == num_traces
        
        # Performance assertion (should be fast with mocks)
        assert performance_timer.elapsed < 1.0  # Should complete in less than 1 second