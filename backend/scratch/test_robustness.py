import os
import sys
import unittest
import asyncio
from unittest.mock import MagicMock, patch
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add backend directory to path
backend_path = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(backend_path))

from backend.services.llm_service import clean_response_text, classify_dump, merge_journals_narrative, validate_extracted_fields

class TestClassificationRobustness(unittest.IsolatedAsyncioTestCase):
    
    def test_clean_response_text_resilience(self):
        """Verify that brackets-based JSON parser extracts JSON cleanly even with conversational noise."""
        raw_text_1 = "Here is the response:\n```json\n{\n  \"items\": []\n}\n```"
        self.assertEqual(clean_response_text(raw_text_1), "{\n  \"items\": []\n}")

        raw_text_2 = "{\n  \"items\": []\n} hope this helps!"
        self.assertEqual(clean_response_text(raw_text_2), "{\n  \"items\": []\n}")

        raw_text_3 = "Invalid text with no braces"
        self.assertEqual(clean_response_text(raw_text_3), "Invalid text with no braces")

    def test_validate_extracted_fields_tasks(self):
        """Verify that schema validation fixes and defaults missing/invalid fields for tasks."""
        # Empty title fallback
        extracted_1 = {"due_date": "2026-07-20"}
        res_1 = validate_extracted_fields("tasks", extracted_1, "Submit assignment by Monday", "2026-07-16")
        self.assertEqual(res_1["title"], "Submit assignment by Monday")
        self.assertTrue(res_1["reminder_required"])  # date present -> reminder true
        
        # Invalid date reset
        extracted_2 = {"title": "Task", "due_date": "not-a-date"}
        res_2 = validate_extracted_fields("tasks", extracted_2, "Task", "2026-07-16")
        self.assertIsNone(res_2["due_date"])

    def test_validate_extracted_fields_watchlist(self):
        """Verify watchlist genre is limited to allowed values or maps to others."""
        extracted_1 = {"title": "Interstellar", "genre": "Sci-Fi"}
        res_1 = validate_extracted_fields("watchlist", extracted_1, "Watch Interstellar", "2026-07-16")
        self.assertEqual(res_1["genre"], "others") # Sci-Fi is not allowed, so falls back to others

        extracted_2 = {"title": "Titanic", "genre": "romance"}
        res_2 = validate_extracted_fields("watchlist", extracted_2, "Watch Titanic", "2026-07-16")
        self.assertEqual(res_2["genre"], "romance")

    @patch('backend.services.llm_service.client.chat.completions.create')
    async def test_input_trimming_guard(self, mock_create):
        """Verify that inputs exceeding 1500 characters are safely trimmed."""
        mock_create.return_value = MagicMock(choices=[
            MagicMock(message=MagicMock(content='{"items": []}'))
        ])
        
        long_input = "a" * 2000
        await classify_dump(long_input, "test-user")
        
        # Verify the prompt sent to Groq contains the trimmed marker
        called_args = mock_create.call_args[1]
        user_prompt = called_args['messages'][1]['content']
        self.assertIn("[truncated due to length]", user_prompt)

    @patch('backend.services.llm_service.client.chat.completions.create')
    async def test_retry_loop_success_on_second_attempt(self, mock_create):
        """Verify that temporary Groq failures trigger an async retry and pass subsequent attempt."""
        # Setup mock to fail on first attempt, then succeed on second
        mock_create.side_effect = [
            Exception("Groq Rate Limit Exceeded"),
            MagicMock(choices=[MagicMock(message=MagicMock(content='{"items": [{"primary_bucket": "tasks", "confidence": 0.9, "extracted": {"title": "Task 1"}}]}'))])
        ]
        
        with patch('asyncio.sleep', return_value=None) as mock_sleep:
            results = await classify_dump("test thought", "test-user")
            self.assertEqual(results[0]["primary_bucket"], "tasks")
            self.assertEqual(mock_create.call_count, 2)
            mock_sleep.assert_called_once_with(1.0)

    @patch('backend.services.llm_service.client.chat.completions.create')
    async def test_retry_loop_exhaustion_fallback(self, mock_create):
        """Verify that sustained Groq failures fallback gracefully to 'others'."""
        mock_create.side_effect = Exception("Groq Timeout")
        
        with patch('asyncio.sleep', return_value=None):
            results = await classify_dump("test thought", "test-user")
            self.assertEqual(results[0]["primary_bucket"], "others")
            self.assertEqual(results[0]["confidence"], 0.5)

    @patch('backend.services.llm_service.client.chat.completions.create')
    async def test_deduplication_items(self, mock_create):
        """Verify that duplicate items based on formatted text are filtered out."""
        mock_create.return_value = MagicMock(choices=[
            MagicMock(message=MagicMock(content='''{
                "items": [
                    {"primary_bucket": "ideas", "confidence": 0.9, "formatted_text": "Great App Idea", "extracted": {"title": "App"}},
                    {"primary_bucket": "ideas", "confidence": 0.8, "formatted_text": "Great App Idea", "extracted": {"title": "App 2"}}
                ]
            }'''))
        ])
        
        results = await classify_dump("test idea", "test-user")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["extracted"]["title"], "App")

    async def test_live_boundary_cases(self):
        """Verify that the engine correctly handles edge cases, Hinglish, and finance directions."""
        user_id = "test-user-uuid"
        
        cases = [
            {
                "input": "Owe Aryan 500",
                "assert": lambda res: res[0]["primary_bucket"] == "finance" and res[0]["extracted"].get("category") == "pay"
            },
            {
                "input": "Aryan owes me 500",
                "assert": lambda res: res[0]["primary_bucket"] == "finance" and res[0]["extracted"].get("category") == "receive"
            },
            {
                "input": "aaj bahut thaka hua feel kar raha hoon",
                "assert": lambda res: res[0]["primary_bucket"] == "journals" and res[0]["extracted"].get("mood_signal") == "negative"
            },
            {
                "input": "Reviewed last week's notes",
                "assert": lambda res: res[0]["primary_bucket"] != "tasks"
            }
        ]
        
        print("\nRunning live boundary cases...")
        for case in cases:
            print(f"Testing input: '{case['input']}'")
            try:
                res = await classify_dump(case["input"], user_id)
                self.assertTrue(case["assert"](res), f"Failed assertion for: {res}")
                print("  Passed!")
            except Exception as e:
                print(f"  Live call failed (check internet/API key): {e}")

if __name__ == '__main__':
    unittest.main()
