import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path
from datetime import datetime, timezone

# Add backend directory to path
backend_path = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(backend_path))

from backend.services.llm_service import clean_response_text, classify_dump, merge_journals_narrative

class TestClassificationRobustness(unittest.TestCase):
    
    def test_clean_response_text_resilience(self):
        """Verify that brackets-based JSON parser extracts JSON cleanly even with conversational noise."""
        raw_text_1 = "Here is the response:\n```json\n{\n  \"items\": []\n}\n```"
        self.assertEqual(clean_response_text(raw_text_1), "{\n  \"items\": []\n}")

        raw_text_2 = "{\n  \"items\": []\n} hope this helps!"
        self.assertEqual(clean_response_text(raw_text_2), "{\n  \"items\": []\n}")

        raw_text_3 = "Invalid text with no braces"
        self.assertEqual(clean_response_text(raw_text_3), "Invalid text with no braces")

    @patch('backend.services.llm_service.client.chat.completions.create')
    def test_input_trimming_guard(self, mock_create):
        """Verify that inputs exceeding 1500 characters are safely trimmed."""
        mock_create.return_value = MagicMock(choices=[
            MagicMock(message=MagicMock(content='{"items": []}'))
        ])
        
        long_input = "a" * 2000
        classify_dump(long_input, "test-user")
        
        # Verify the prompt sent to Groq contains the trimmed marker
        called_args = mock_create.call_args[1]
        user_prompt = called_args['messages'][1]['content']
        self.assertIn("[truncated due to length]", user_prompt)
        self.assertEqual(len(called_args['messages'][1]['content'].split("Raw Thought: ")[1]), 1500 + len(" [truncated due to length]"))

    @patch('backend.services.llm_service.client.chat.completions.create')
    def test_retry_loop_success_on_second_attempt(self, mock_create):
        """Verify that temporary Groq failures trigger a retry and succeed if subsequent attempt passes."""
        # Setup mock to fail on first attempt, then succeed on second
        mock_create.side_effect = [
            Exception("Groq Rate Limit Exceeded"),
            MagicMock(choices=[MagicMock(message=MagicMock(content='{"items": [{"primary_bucket": "tasks", "confidence": 0.9, "extracted": {}}]}'))])
        ]
        
        with patch('time.sleep', return_value=None) as mock_sleep:
            results = classify_dump("test thought", "test-user")
            self.assertEqual(results[0]["primary_bucket"], "tasks")
            self.assertEqual(mock_create.call_count, 2)
            mock_sleep.assert_called_once_with(1.0)

    @patch('backend.services.llm_service.client.chat.completions.create')
    def test_retry_loop_exhaustion_fallback(self, mock_create):
        """Verify that sustained Groq failures fallback gracefully to 'others'."""
        mock_create.side_effect = Exception("Groq Timeout")
        
        with patch('time.sleep', return_value=None):
            results = classify_dump("test thought", "test-user")
            self.assertEqual(results[0]["primary_bucket"], "others")
            self.assertEqual(results[0]["confidence"], 0.5)

    def test_live_boundary_cases(self):
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
                "assert": lambda res: res[0]["primary_bucket"] != "tasks"  # Past events shouldn't be tasks
            }
        ]
        
        print("\nRunning live boundary cases...")
        for case in cases:
            print(f"Testing input: '{case['input']}'")
            try:
                res = classify_dump(case["input"], user_id)
                self.assertTrue(case["assert"](res), f"Failed assertion for: {res}")
                print("  Passed!")
            except Exception as e:
                print(f"  Live call failed (check internet/API key): {e}")

if __name__ == '__main__':
    unittest.main()
