import os
import sys
from pathlib import Path

# Add backend directory to path
backend_path = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(backend_path))

from backend.services.llm_service import classify_dump
from backend.services.classification_service import process_user_dump
from backend.config import settings

def run_test_pipeline():
    print("Starting AI Classification Pipeline verification...")
    
    # Check for API key
    if not settings.GROQ_API_KEY or "your_" in settings.GROQ_API_KEY:
        print("WARNING: GROQ_API_KEY is not configured. Skipping live API test.")
        return
        
    test_inputs = [
        "Spent 450 on groceries and need to buy milk tomorrow morning",
        "Had a great idea for a hostel mess food quality tracking app",
        "Slept only 4 hours last night feeling very tired today",
        "Call mom tomorrow afternoon at 3pm"
      ]
      
    user_id = "test-user-uuid"
    
    for text in test_inputs:
        print(f"\nProcessing Dump: '{text}'")
        try:
            results = classify_dump(text, user_id)
            print("Classification Output:")
            for idx, item in enumerate(results):
                print(f"  Item {idx+1}:")
                print(f"    Primary Bucket: {item.get('primary_bucket')}")
                print(f"    Secondary Buckets: {item.get('secondary_buckets')}")
                print(f"    Confidence: {item.get('confidence')}")
                print(f"    Formatted Text: {item.get('formatted_text')}")
                print(f"    Extracted Data: {item.get('extracted')}")
        except Exception as e:
            print(f"  Error processing: {e}")

if __name__ == "__main__":
    run_test_pipeline()
