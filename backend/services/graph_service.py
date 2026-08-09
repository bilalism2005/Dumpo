import logging
import json
from typing import TypedDict, List, Dict, Any, Optional, Annotated
import operator
from langgraph.graph import StateGraph, END
from langgraph.store.memory import InMemoryStore
from backend.services.llm_service import router_node_llm, client, MODEL_NAME
from backend.services.bucket_service import write_to_bucket
from backend.services.supabase_service import get_supabase_client
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)
supabase = get_supabase_client()

# Define AgentState
class AgentState(TypedDict):
    raw_input: str
    user_id: str
    message_id: str
    current_time_context: Optional[str]
    
    # Router Outputs
    dump_type: str
    journal_segment: Optional[str]
    atomic_items: List[Dict[str, Any]]
    
    # Output Aggregators
    response_messages: Annotated[List[str], operator.add]
    bucket_tags: Annotated[List[str], operator.add]
    items: Annotated[List[Dict[str, Any]], operator.add]
    success: bool

# Initialize global in-memory store for LangGraph
memory_store = InMemoryStore()

# We will populate the store asynchronously or sync with Supabase (simplified for now)
def sync_user_memory(user_id: str):
    """
    Sync active project facts and relationships from Supabase into LangGraph Store.
    For MVP, we query recent tasks and ideas.
    """
    try:
        tasks_res = supabase.table("tasks").select("title, due_date").eq("user_id", user_id).eq("is_complete", False).limit(10).execute()
        ideas_res = supabase.table("ideas").select("title, description").eq("user_id", user_id).limit(10).execute()
        
        memories = {
            "active_tasks": tasks_res.data,
            "active_ideas": ideas_res.data
        }
        
        memory_store.put(("memories", user_id), "active_projects", memories)
    except Exception as e:
        logger.error(f"Error syncing user memory: {e}")

async def router_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]
    sync_user_memory(user_id)
    
    # Retrieve from LangGraph Store
    stored_memories = memory_store.get(("memories", user_id), "active_projects")
    memory_context = ""
    if stored_memories and stored_memories.value:
        memory_context = json.dumps(stored_memories.value)
        
    router_output = await router_node_llm(
        text=state["raw_input"],
        user_id=user_id,
        memory_context=memory_context,
        current_time_context=state["current_time_context"]
    )
    
    return {
        "dump_type": router_output.get("dump_type", "atomic"),
        "journal_segment": router_output.get("journal_segment"),
        "atomic_items": router_output.get("atomic_items", []),
    }

async def create_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]
    message_id = state["message_id"]
    
    new_items = []
    
    # Save Journal if exists
    if state.get("journal_segment"):
        try:
            journal_data = {
                "user_id": user_id,
                "dump_id": message_id,
                "title": "Daily Entry",
                "content": state["journal_segment"],
                "journal_date": state.get("current_time_context", datetime.now().isoformat()).split("T")[0],
                "mood_signal": "neutral"
            }
            res = supabase.table("journals").insert(journal_data).execute()
            new_items.append({
                "id": res.data[0]["id"] if res.data else None,
                "primary_bucket": "journals",
                "bucket_tags": ["📓 Journal"],
                "confirmation_text": "Added narrative to Journal.",
                "extracted": journal_data,
                "reminder_set": False
            })
        except Exception as e:
            logger.error(f"Failed to insert journal segment: {e}")

    # Process CREATE atomic items
    for item in state.get("atomic_items", []):
        if item.get("action_type") == "CREATE":
            primary = item.get("primary_bucket", "others")
            extracted = item.get("extracted", {})
            try:
                db_record = await write_to_bucket(
                    user_id=user_id,
                    dump_id=message_id,
                    bucket=primary,
                    secondary_buckets=[],
                    extracted_data=extracted
                )
                
                new_items.append({
                    "id": db_record.get("id") if db_record else None,
                    "primary_bucket": primary,
                    "bucket_tags": [f"✅ {primary.capitalize()}"],
                    "confirmation_text": f"Created {primary} item.",
                    "extracted": extracted,
                    "reminder_set": bool(extracted.get("reminder_required", False))
                })
            except Exception as e:
                logger.error(f"Failed to create item in {primary}: {e}")
                
    return {"items": new_items, "success": True}

async def crud_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]
    crud_responses = []
    
    for item in state.get("atomic_items", []):
        if item.get("action_type") == "CRUD":
            text = item.get("formatted_text", "")
            # Simplified CRUD logic: For MVP we will just return a placeholder message saying CRUD action logged.
            # In a real implementation we would do SQL fuzzy search here.
            crud_responses.append({
                "primary_bucket": "crud_action",
                "bucket_tags": ["🛠️ Action"],
                "confirmation_text": f"Processed update/delete for: {text}",
                "extracted": {},
                "reminder_set": False
            })
            
    return {"items": crud_responses, "success": True}

async def chatbot_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]
    chat_responses = []
    
    for item in state.get("atomic_items", []):
        if item.get("action_type") == "CHAT":
            text = item.get("formatted_text", "")
            try:
                # Direct Chat response
                completion = client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=[{"role": "user", "content": text}],
                    temperature=0.7
                )
                reply = completion.choices[0].message.content
                chat_responses.append({
                    "primary_bucket": "chat",
                    "bucket_tags": ["💬 Chat"],
                    "confirmation_text": reply,
                    "extracted": {},
                    "reminder_set": False
                })
            except Exception as e:
                logger.error(f"Chatbot failed: {e}")
                
    return {"items": chat_responses, "success": True}

async def output_compiler_node(state: AgentState) -> AgentState:
    # All items are already accumulated in state["items"] via Annotated operator.add
    # We just ensure success flag and compile final response.
    return {"success": True}

def route_from_router(state: AgentState) -> List[str]:
    destinations = []
    if state.get("journal_segment"):
        destinations.append("create_node")
        
    has_create = False
    has_crud = False
    has_chat = False
    
    for item in state.get("atomic_items", []):
        act = item.get("action_type")
        if act == "CREATE":
            has_create = True
        elif act == "CRUD":
            has_crud = True
        elif act == "CHAT":
            has_chat = True
            
    if has_create and "create_node" not in destinations:
        destinations.append("create_node")
    if has_crud:
        destinations.append("crud_node")
    if has_chat:
        destinations.append("chatbot_node")
        
    if not destinations:
        # Fallback
        destinations.append("create_node")
        
    return destinations

# Build the Graph
workflow = StateGraph(AgentState)

workflow.add_node("router_node", router_node)
workflow.add_node("create_node", create_node)
workflow.add_node("crud_node", crud_node)
workflow.add_node("chatbot_node", chatbot_node)
workflow.add_node("output_compiler_node", output_compiler_node)

workflow.set_entry_point("router_node")

# Conditional Edges from Router to action nodes (Parallel Execution)
workflow.add_conditional_edges("router_node", route_from_router, {
    "create_node": "create_node",
    "crud_node": "crud_node",
    "chatbot_node": "chatbot_node"
})

# All action nodes go to compiler
workflow.add_edge("create_node", "output_compiler_node")
workflow.add_edge("crud_node", "output_compiler_node")
workflow.add_edge("chatbot_node", "output_compiler_node")

workflow.add_edge("output_compiler_node", END)

dumpo_graph = workflow.compile(store=memory_store)

async def process_user_dump_graph(user_id: str, message_id: str, text: str, current_time_context: Optional[str] = None) -> Dict[str, Any]:
    # Initialize state
    initial_state = {
        "raw_input": text,
        "user_id": user_id,
        "message_id": message_id,
        "current_time_context": current_time_context,
        "dump_type": "",
        "journal_segment": None,
        "atomic_items": [],
        "response_messages": [],
        "bucket_tags": [],
        "items": [],
        "success": False
    }
    
    # Save the raw message to chat_messages
    try:
        message_data = {
            "id": message_id,
            "user_id": user_id,
            "content": text,
            "role": "user"
        }
        supabase.table("chat_messages").insert(message_data).execute()
    except Exception as e:
        logger.error(f"Failed to log user chat message: {e}")
        
    # Run the graph
    final_state = await dumpo_graph.ainvoke(initial_state)
    
    response_items = final_state.get("items", [])
    
    # Save assistant responses to chat logs
    for item in response_items:
        try:
            assistant_msg = {
                "user_id": user_id,
                "content": item.get("confirmation_text", ""),
                "role": "assistant",
                "bucket_tags": item.get("bucket_tags", []),
                "reminder_set": item.get("reminder_set", False),
                "reminder_text": item.get("reminder_text"),
                "items": [item]
            }
            supabase.table("chat_messages").insert(assistant_msg).execute()
        except Exception as e:
            logger.error(f"Failed to log assistant chat message: {e}")
            
    return {
        "success": True,
        "items": response_items
    }
