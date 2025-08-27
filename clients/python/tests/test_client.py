"""
Unit tests for CloudContext Python client
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import aiohttp
import json

from client import CloudContext, SaveResult
from tests.conftest import MockContextManager


class TestCloudContext:
    """Unit tests for CloudContext class"""

    def test_init(self, client_config):
        """Test CloudContext initialization"""
        client = CloudContext(**client_config)
        
        assert client.base_url == 'https://api.example.com'
        assert client.api_key == 'test-api-key'
        assert client.context_id == 'test-context'
        assert client.session is None

    def test_init_strips_trailing_slash(self):
        """Test that trailing slash is removed from base_url"""
        client = CloudContext(
            base_url='https://api.example.com/',
            api_key='test-key'
        )
        assert client.base_url == 'https://api.example.com'

    def test_init_default_context_id(self):
        """Test default context_id is set"""
        client = CloudContext(
            base_url='https://api.example.com',
            api_key='test-key'
        )
        assert client.context_id == 'default'

    @pytest.mark.asyncio
    async def test_context_manager(self, client_config):
        """Test async context manager functionality"""
        client = CloudContext(**client_config)
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            mock_session = AsyncMock()
            mock_session_class.return_value = mock_session
            
            async with client as ctx:
                assert ctx is client
                assert client.session is mock_session
                mock_session_class.assert_called_once()
            
            mock_session.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_save_success(self, client_config, mock_response):
        """Test successful save operation"""
        client = CloudContext(**client_config)
        
        # Mock response data
        response_data = {
            'success': True,
            'context_id': 'test-context',
            'version': 1,
            'timestamp': '2023-01-01T00:00:00Z'
        }
        
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.post.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        content = {'message': 'test content'}
        metadata = {'tag': 'test'}
        
        result = await client.save(content, metadata)
        
        # Verify result
        assert isinstance(result, SaveResult)
        assert result.success is True
        assert result.context_id == 'test-context'
        assert result.version == 1
        assert result.timestamp == '2023-01-01T00:00:00Z'
        
        # Verify API call
        mock_session.post.assert_called_once_with(
            'https://api.example.com/api/context',
            headers={
                'Authorization': 'Bearer test-api-key',
                'X-Context-ID': 'test-context'
            },
            json={
                'content': content,
                'metadata': metadata
            }
        )

    @pytest.mark.asyncio
    async def test_save_with_custom_context_id(self, client_config, mock_response):
        """Test save with custom context ID"""
        client = CloudContext(**client_config)
        
        response_data = {'success': True, 'context_id': 'custom-context', 'version': 1, 'timestamp': ''}
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.post.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        await client.save({'test': 'data'}, context_id='custom-context')
        
        mock_session.post.assert_called_once()
        call_args = mock_session.post.call_args
        assert call_args[1]['headers']['X-Context-ID'] == 'custom-context'

    @pytest.mark.asyncio
    async def test_save_with_default_metadata(self, client_config, mock_response):
        """Test save with default metadata"""
        client = CloudContext(**client_config)
        
        response_data = {'success': True, 'context_id': 'test', 'version': 1, 'timestamp': ''}
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.post.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        await client.save({'test': 'data'})
        
        call_args = mock_session.post.call_args
        assert call_args[1]['json']['metadata'] == {}

    @pytest.mark.asyncio
    async def test_save_error(self, client_config, mock_error_response):
        """Test save operation error handling"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_error_response(400, 'Bad Request')
        mock_session = AsyncMock()
        mock_session.post.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        with pytest.raises(Exception, match="Failed to save context: Bad Request"):
            await client.save({'test': 'data'})

    @pytest.mark.asyncio
    async def test_get_success(self, client_config, mock_response):
        """Test successful get operation"""
        client = CloudContext(**client_config)
        
        response_data = {
            'content': {'message': 'retrieved content'},
            'metadata': {'tag': 'retrieved'}
        }
        
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.get.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        result = await client.get()
        
        assert result == response_data
        
        mock_session.get.assert_called_once_with(
            'https://api.example.com/api/context',
            headers={
                'Authorization': 'Bearer test-api-key',
                'X-Context-ID': 'test-context'
            }
        )

    @pytest.mark.asyncio
    async def test_get_with_custom_context_id(self, client_config, mock_response):
        """Test get with custom context ID"""
        client = CloudContext(**client_config)
        
        response_data = {'content': 'test', 'metadata': {}}
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.get.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        await client.get('custom-context')
        
        call_args = mock_session.get.call_args
        assert call_args[1]['headers']['X-Context-ID'] == 'custom-context'

    @pytest.mark.asyncio
    async def test_get_error(self, client_config, mock_error_response):
        """Test get operation error handling"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_error_response(404, 'Not Found')
        mock_session = AsyncMock()
        mock_session.get.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        with pytest.raises(Exception, match="Failed to get context: Not Found"):
            await client.get()

    @pytest.mark.asyncio
    async def test_delete_success(self, client_config, mock_response):
        """Test successful delete operation"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_response({}, 200)
        mock_session = AsyncMock()
        mock_session.delete.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        result = await client.delete()
        
        assert result is True
        
        mock_session.delete.assert_called_once_with(
            'https://api.example.com/api/context',
            headers={
                'Authorization': 'Bearer test-api-key',
                'X-Context-ID': 'test-context'
            }
        )

    @pytest.mark.asyncio
    async def test_delete_with_custom_context_id(self, client_config, mock_response):
        """Test delete with custom context ID"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_response({}, 200)
        mock_session = AsyncMock()
        mock_session.delete.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        await client.delete('custom-context')
        
        call_args = mock_session.delete.call_args
        assert call_args[1]['headers']['X-Context-ID'] == 'custom-context'

    @pytest.mark.asyncio
    async def test_delete_error(self, client_config, mock_error_response):
        """Test delete operation error handling"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_error_response(403, 'Forbidden')
        mock_session = AsyncMock()
        mock_session.delete.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        with pytest.raises(Exception, match="Failed to delete context: Forbidden"):
            await client.delete()

    @pytest.mark.asyncio
    async def test_list_success(self, client_config, mock_response):
        """Test successful list operation"""
        client = CloudContext(**client_config)
        
        response_data = {
            'contexts': ['context1', 'context2', 'context3']
        }
        
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.get.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        result = await client.list()
        
        assert result == ['context1', 'context2', 'context3']
        
        mock_session.get.assert_called_once_with(
            'https://api.example.com/api/context/list',
            headers={
                'Authorization': 'Bearer test-api-key'
            }
        )

    @pytest.mark.asyncio
    async def test_list_empty(self, client_config, mock_response):
        """Test list operation with empty result"""
        client = CloudContext(**client_config)
        
        response_data = {'contexts': []}
        mock_resp = mock_response(response_data, 200)
        mock_session = AsyncMock()
        mock_session.get.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        result = await client.list()
        
        assert result == []

    @pytest.mark.asyncio
    async def test_list_error(self, client_config, mock_error_response):
        """Test list operation error handling"""
        client = CloudContext(**client_config)
        
        mock_resp = mock_error_response(500, 'Internal Server Error')
        mock_session = AsyncMock()
        mock_session.get.return_value = MockContextManager(mock_resp)
        
        client.session = mock_session
        
        with pytest.raises(Exception, match="Failed to list contexts: Internal Server Error"):
            await client.list()


class TestSaveResult:
    """Tests for SaveResult dataclass"""
    
    def test_save_result_creation(self):
        """Test SaveResult dataclass creation"""
        result = SaveResult(
            success=True,
            context_id='test-context',
            version=1,
            timestamp='2023-01-01T00:00:00Z'
        )
        
        assert result.success is True
        assert result.context_id == 'test-context'
        assert result.version == 1
        assert result.timestamp == '2023-01-01T00:00:00Z'
    
    def test_save_result_from_dict(self):
        """Test creating SaveResult from dictionary"""
        data = {
            'success': True,
            'context_id': 'test-context',
            'version': 2,
            'timestamp': '2023-01-01T00:00:00Z'
        }
        
        result = SaveResult(**data)
        
        assert result.success is True
        assert result.context_id == 'test-context'
        assert result.version == 2
        assert result.timestamp == '2023-01-01T00:00:00Z'
