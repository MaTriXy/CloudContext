"""
CloudContext Python Client
"""

import json
import aiohttp
from typing import Dict, Any, Optional, List
from dataclasses import dataclass


@dataclass
class SaveResult:
    success: bool
    context_id: str
    version: int
    timestamp: str


class CloudContext:
    def __init__(self, base_url: str, api_key: str, context_id: str = "default"):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.context_id = context_id
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def save(self, content: Dict[str, Any], metadata: Optional[Dict] = None, context_id: Optional[str] = None) -> SaveResult:
        ctx_id = context_id or self.context_id
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'X-Context-ID': ctx_id
        }
        
        payload = {'content': content, 'metadata': metadata or {}}
        
        async with self.session.post(f'{self.base_url}/api/context', headers=headers, json=payload) as resp:
            if resp.status != 200:
                raise Exception(f"Failed to save context: {await resp.text()}")
            
            data = await resp.json()
            return SaveResult(**data)
            
    async def get(self, context_id: Optional[str] = None) -> Dict[str, Any]:
        ctx_id = context_id or self.context_id
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'X-Context-ID': ctx_id
        }
        
        async with self.session.get(f'{self.base_url}/api/context', headers=headers) as resp:
            if resp.status != 200:
                raise Exception(f"Failed to get context: {await resp.text()}")
            
            return await resp.json()
            
    async def delete(self, context_id: Optional[str] = None) -> bool:
        ctx_id = context_id or self.context_id
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'X-Context-ID': ctx_id
        }
        
        async with self.session.delete(f'{self.base_url}/api/context', headers=headers) as resp:
            if resp.status != 200:
                raise Exception(f"Failed to delete context: {await resp.text()}")
            
            return True
            
    async def list(self) -> List[Dict[str, Any]]:
        headers = {'Authorization': f'Bearer {self.api_key}'}
        
        async with self.session.get(f'{self.base_url}/api/context/list', headers=headers) as resp:
            if resp.status != 200:
                raise Exception(f"Failed to list contexts: {await resp.text()}")
            
            data = await resp.json()
            return data['contexts']
