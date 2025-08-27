"""
Pytest configuration and fixtures for CloudContext Python client tests
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
import aiohttp
from aiohttp import ClientResponse
import json


@pytest.fixture
def mock_session():
    """Mock aiohttp ClientSession"""
    session = AsyncMock(spec=aiohttp.ClientSession)
    return session


@pytest.fixture
def mock_response():
    """Factory for creating mock HTTP responses"""
    def _create_response(data=None, status=200, content_type='application/json'):
        response = AsyncMock(spec=ClientResponse)
        response.status = status
        response.ok = status < 400
        
        if data is not None:
            response.json = AsyncMock(return_value=data)
            response.text = AsyncMock(return_value=json.dumps(data))
        else:
            response.json = AsyncMock(side_effect=Exception("No JSON data"))
            response.text = AsyncMock(return_value="")
            
        return response
    
    return _create_response


@pytest.fixture
def mock_error_response():
    """Factory for creating mock HTTP error responses"""
    def _create_error_response(status=500, text="Internal Server Error"):
        response = AsyncMock(spec=ClientResponse)
        response.status = status
        response.ok = False
        response.json = AsyncMock(side_effect=Exception("Error response"))
        response.text = AsyncMock(return_value=text)
        return response
    
    return _create_error_response


@pytest.fixture
def client_config():
    """Default client configuration for tests"""
    return {
        'base_url': 'https://api.example.com',
        'api_key': 'test-api-key',
        'context_id': 'test-context'
    }


@pytest.fixture
async def mock_client_session():
    """Mock client session that can be used as async context manager"""
    session = AsyncMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=None)
    session.close = AsyncMock()
    return session


class MockContextManager:
    """Helper class for mocking async context managers"""
    def __init__(self, response):
        self.response = response
    
    async def __aenter__(self):
        return self.response
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
