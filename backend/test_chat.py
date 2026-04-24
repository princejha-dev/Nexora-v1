import asyncio
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from main import app
from api.auth import get_current_user

# Mock authentication to return a fake user
async def override_get_current_user():
    return {"user_id": "test_user_id", "email": "test@example.com"}

app.dependency_overrides[get_current_user] = override_get_current_user

def test_chat_endpoint():
    print("\n=== TESTING CHAT ENDPOINT ===")
    
    # We need to mock supabase project check and similarity_search
    with patch("api.chat.supabase") as mock_supabase, \
         patch("api.chat.similarity_search") as mock_search, \
         patch("api.chat.ChatGroq") as mock_chatgroq:
        
        # Mock project check
        mock_execute = MagicMock()
        mock_execute.execute.return_value = MagicMock(data=[{"id": "test_proj"}])
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value = mock_execute
        
        # Mock similarity search
        async def mock_sim_search(*args, **kwargs):
            return [{"content": "This is test context from document.", "metadata": {}}]
        mock_search.side_effect = mock_sim_search
        
        # Mock ChatGroq to yield chunks
        mock_llm_instance = MagicMock()
        
        async def mock_astream(*args, **kwargs):
            chunks = ["Hello", " ", "world", "!", " This", " ", "is", " ", "a", " ", "test."]
            for chunk_text in chunks:
                chunk_mock = MagicMock()
                chunk_mock.content = chunk_text
                yield chunk_mock
                
        mock_llm_instance.astream.side_effect = mock_astream
        mock_chatgroq.return_value = mock_llm_instance

        client = TestClient(app)
        
        print("Sending request to /api/chat/test_proj...")
        response = client.post(
            "/api/chat/test_proj",
            json={"message": "What is this?"}
        )
        
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        
        # Parse SSE
        lines = response.text.strip().split("\n\n")
        print(f"Received {len(lines)} SSE events.")
        
        full_text = ""
        for event in lines:
            if event.startswith("data: "):
                data = event[6:]
                if data == "[DONE]":
                    break
                full_text += data
                
        print(f"Reconstructed message: '{full_text}'")
        assert full_text == "Hello world! This is a test.", f"Expected 'Hello world! This is a test.', got '{full_text}'"
        print("Chat streaming test passed successfully!")

if __name__ == "__main__":
    test_chat_endpoint()
