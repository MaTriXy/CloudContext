"""
Integration tests for CloudContext Python client
"""

import pytest
import asyncio
import os
from unittest.mock import AsyncMock, patch
import aiohttp

from client import CloudContext, SaveResult
from tests.conftest import MockContextManager


class TestCloudContextIntegration:
    """Integration tests for CloudContext"""

    @pytest.fixture
    def integration_config(self):
        """Configuration for integration tests"""
        return {
            'base_url': os.getenv('CLOUDCONTEXT_BASE_URL', 'https://api.example.com'),
            'api_key': os.getenv('CLOUDCONTEXT_API_KEY', 'test-api-key'),
            'context_id': f'test-integration-{int(asyncio.get_event_loop().time())}'
        }

    @pytest.mark.integration
    @pytest.mark.skipif(
        not os.getenv('CLOUDCONTEXT_BASE_URL'),
        reason="Real API integration tests require CLOUDCONTEXT_BASE_URL environment variable"
    )
    @pytest.mark.asyncio
    async def test_full_crud_operations(self, integration_config):
        """Test complete CRUD operations against real API"""
        async with CloudContext(**integration_config) as client:
            # Test data
            test_content = {
                'message': 'Integration test content',
                'data': [1, 2, 3, 4, 5]
            }
            test_metadata = {
                'test': True,
                'timestamp': asyncio.get_event_loop().time(),
                'source': 'integration-test'
            }

            # Save content
            save_result = await client.save(test_content, test_metadata)
            assert isinstance(save_result, SaveResult)
            assert save_result.success is True
            assert save_result.context_id == integration_config['context_id']

            # Get content
            retrieved_context = await client.get()
            assert retrieved_context['content'] == test_content
            assert 'test' in retrieved_context['metadata']
            assert retrieved_context['metadata']['test'] is True

            # List contexts
            contexts = await client.list()
            assert isinstance(contexts, list)
            assert integration_config['context_id'] in contexts

            # Delete content
            delete_result = await client.delete()
            assert delete_result is True

            # Verify deletion
            with pytest.raises(Exception, match="Failed to get context"):
                await client.get()

    @pytest.mark.integration
    @pytest.mark.skipif(
        not os.getenv('CLOUDCONTEXT_BASE_URL'),
        reason="Real API integration tests require CLOUDCONTEXT_BASE_URL environment variable"
    )
    @pytest.mark.asyncio
    async def test_multiple_contexts(self, integration_config):
        """Test operations with multiple contexts"""
        base_context_id = integration_config['context_id']
        context1_id = f"{base_context_id}-1"
        context2_id = f"{base_context_id}-2"

        async with CloudContext(**integration_config) as client:
            # Save to multiple contexts
            content1 = {'id': 1, 'message': 'Content 1'}
            content2 = {'id': 2, 'message': 'Content 2'}
            
            await client.save(content1, {'id': 1}, context1_id)
            await client.save(content2, {'id': 2}, context2_id)

            # Retrieve from both contexts
            retrieved1 = await client.get(context1_id)
            retrieved2 = await client.get(context2_id)

            assert retrieved1['content'] == content1
            assert retrieved2['content'] == content2
            assert retrieved1['metadata']['id'] == 1
            assert retrieved2['metadata']['id'] == 2

            # Clean up
            await client.delete(context1_id)
            await client.delete(context2_id)

    @pytest.mark.asyncio
    async def test_mock_network_errors(self, client_config):
        """Test handling of various network errors"""
        client = CloudContext(**client_config)
        
        # Test connection error
        with patch('aiohttp.ClientSession') as mock_session_class:
            mock_session = AsyncMock()
            mock_session.post.side_effect = aiohttp.ClientError("Connection failed")
            mock_session_class.return_value = mock_session
            
            async with client:
                with pytest.raises(aiohttp.ClientError, match="Connection failed"):
                    await client.save({'test': 'data'})

    @pytest.mark.asyncio
    async def test_mock_timeout_errors(self, client_config):
        """Test handling of timeout errors"""
        client = CloudContext(**client_config)
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            mock_session = AsyncMock()
            mock_session.get.side_effect = asyncio.TimeoutError("Request timeout")
            mock_session_class.return_value = mock_session
            
            async with client:
                with pytest.raises(asyncio.TimeoutError, match="Request timeout"):
                    await client.get()

    @pytest.mark.asyncio
    async def test_mock_malformed_json_response(self, client_config):
        """Test handling of malformed JSON responses"""
        client = CloudContext(**client_config)
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.ok = True
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_response.text.return_value = "Invalid JSON response"
        
        mock_session = AsyncMock()
        mock_session.get.return_value = MockContextManager(mock_response)
        
        client.session = mock_session
        
        with pytest.raises(ValueError, match="Invalid JSON"):
            await client.get()

    @pytest.mark.asyncio
    async def test_mock_rate_limiting(self, client_config, mock_error_response):
        """Test handling of rate limiting"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_error_response(429, 'Too Many Requests')
        mock_session = AsyncMock()
        mock_session.post.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        with pytest.raises(Exception, match="Failed to save context: Too Many Requests"):
            await client.save({'test': 'data'})

    @pytest.mark.asyncio
    async def test_mock_authentication_error(self, client_config, mock_error_response):
        """Test handling of authentication errors"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_error_response(401, 'Unauthorized')
        mock_session = AsyncMock()
        mock_session.get.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        with pytest.raises(Exception, match="Failed to get context: Unauthorized"):
            await client.get()

    @pytest.mark.asyncio
    async def test_mock_server_error(self, client_config, mock_error_response):
        """Test handling of server errors"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_error_response(500, 'Internal Server Error')
        mock_session = AsyncMock()
        mock_session.delete.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        with pytest.raises(Exception, match="Failed to delete context: Internal Server Error"):
            await client.delete()

    @pytest.mark.asyncio
    async def test_session_lifecycle(self, client_config):
        """Test proper session lifecycle management"""
        client = CloudContext(**client_config)
        
        # Test that session is None initially
        assert client.session is None
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            mock_session = AsyncMock()
            mock_session_class.return_value = mock_session
            
            # Test context manager creates session
            async with client as ctx:
                assert ctx is client
                assert client.session is mock_session
                mock_session_class.assert_called_once()
            
            # Test session is closed after context
            mock_session.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_complex_data_types(self, client_config, mock_response):
        """Test handling of complex data types"""
        client = CloudContext(**client_config)
        
        # Complex test data
        complex_content = {
            'strings': ['hello', 'world'],
            'numbers': [1, 2.5, -3],
            'boolean': True,
            'null': None,
            'nested': {
                'deep': {
                    'value': 'nested_value'
                }
            },
            'mixed_array': [1, 'string', {'key': 'value'}, [1, 2, 3]]
        }
        
        complex_metadata = {
            'tags': ['python', 'integration', 'test'],
            'config': {
                'enabled': True,
                'timeout': 30,
                'retries': 3
            }
        }
        
        response_data = {'success': True, 'context_id': 'test', 'version': 1, 'timestamp': ''}
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.post.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        result = await client.save(complex_content, complex_metadata)
        
        assert result.success is True
        
        # Verify the complex data was serialized correctly
        call_args = mock_session.post.call_args
        json_data = call_args[1]['json']
        assert json_data['content'] == complex_content
        assert json_data['metadata'] == complex_metadata

    @pytest.mark.asyncio
    async def test_concurrent_operations(self, client_config, mock_response):
        """Test concurrent operations"""
        client = CloudContext(**client_config)
        
        response_data = {'success': True, 'context_id': 'test', 'version': 1, 'timestamp': ''}
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.post.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        # Run multiple save operations concurrently
        tasks = []
        for i in range(5):
            task = client.save(
                {'message': f'Concurrent message {i}'},
                {'index': i},
                f'concurrent-context-{i}'
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        # Verify all operations completed successfully
        assert len(results) == 5
        for result in results:
            assert result.success is True
        
        # Verify all calls were made
        assert mock_session.post.call_count == 5
