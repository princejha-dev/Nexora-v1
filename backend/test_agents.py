import asyncio
from config import get_settings
from core import parser, embedder
from agents import ingestion_agent, entity_agent, pattern_agent, narrative_agent

# Dummy data for testing
SAMPLE_TEXT = """
On March 15, 2023, John Doe (CEO of Apex Holdings Ltd) transferred $5,000,000 to a shell corporation known as 
Offshore Ventures Inc based in the Cayman Islands. The transaction was facilitated by Jane Smith, the CFO. 
The funds originated from a government contract awarded to Apex Holdings just three days prior.
"""

async def test_parser():
    print("\n=== TESTING PARSER ===")
    print("Chunking sample text...")
    chunks = parser.chunk_text(SAMPLE_TEXT)
    print(f"Total chunks created: {len(chunks)}")
    for i, chunk in enumerate(chunks):
        print(f" Chunk {i+1}: {chunk[:50]}...")
    return chunks

async def test_embedder():
    print("\n=== TESTING EMBEDDER ===")
    print("Testing embed_query...")
    try:
        vector = embedder.embed_query("Who is John Doe?")
        print(f"Success! Generated embedding of {len(vector)} dimensions.")
    except Exception as e:
        print(f"Embedder failed: {e}")

async def test_ingestion_agent():
    print("\n=== TESTING INGESTION AGENT ===")
    print("Classifying sample text...")
    try:
        # emit is optional, passing None
        res = await ingestion_agent.run([{"content": SAMPLE_TEXT}], emit=None)
        doc = res[0]
        print(f"Classification: {doc['classification']['document_type']} (Topic: {doc['classification']['key_topic']})")
    except Exception as e:
        print(f"Ingestion Agent failed: {e}")

async def test_entity_agent():
    print("\n=== TESTING ENTITY AGENT ===")
    print("Extracting entities from chunks...")
    chunks = [SAMPLE_TEXT] # Single chunk for simplicity
    try:
        res = await entity_agent.run(chunks, emit=None)
        print(f"Extracted {len(res['entities'])} entities and {len(res['relationships'])} relationships.")
        
        print("\nEntities:")
        for ent in res['entities']:
            print(f" - [{ent['type']}] {ent['name']}")
            
        print("\nRelationships:")
        for rel in res['relationships']:
            print(f" - {rel['entity_a']} -> {rel['entity_b']} ({rel['label']})")
            
        return res
    except Exception as e:
        print(f"Entity Agent failed: {e}")
        return None

async def test_pattern_agent(graph_data):
    print("\n=== TESTING PATTERN AGENT ===")
    if not graph_data:
        print("Skipping (no graph data from entity agent).")
        return None
    print("Analyzing graph for suspicious patterns...")
    try:
        findings = await pattern_agent.run(graph_data['entities'], graph_data['relationships'], emit=None)
        print(f"Found {len(findings)} suspicious patterns.")
        for f in findings:
            print(f" - [{f['pattern_type']}] Score: {f['suspicion_score']}/10 : {f['title']}")
        return findings
    except Exception as e:
        print(f"Pattern Agent failed: {e}")
        return None

async def test_narrative_agent(graph_data, findings):
    print("\n=== TESTING NARRATIVE AGENT ===")
    if not graph_data or not findings:
        print("Skipping (missing previous data).")
        return
    print("Drafting journalistic narrative...")
    try:
        story = await narrative_agent.run(graph_data['entities'], findings, SAMPLE_TEXT, emit=None)
        print("\n[JOURNALIST DRAFT PREVIEW]")
        print("-" * 50)
        print(story[:500] + "...\n[TRUNCATED]")
        print("-" * 50)
    except Exception as e:
        print(f"Narrative Agent failed: {e}")

async def main():
    print("Starting Comprehensive Backend Module Tests...")
    
    # 1. Test Core Operations
    await test_parser()
    await test_embedder()
    
    # 2. Test Agent Pipeline Sequentially
    await test_ingestion_agent()
    
    graph_data = await test_entity_agent()
    findings = await test_pattern_agent(graph_data)
    await test_narrative_agent(graph_data, findings)
    
    print("\n=== ALL TESTS COMPLETED ===")

if __name__ == "__main__":
    asyncio.run(main())
