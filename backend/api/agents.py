from fastapi import APIRouter, Depends
from api.auth import get_current_user
from agents.narrative_agent import run as draft
from db.supabase import supabase

router = APIRouter(prefix="/api/agents", tags=["agents"])

@router.post("/narrative/{project_id}")
async def generate_narrative(
    project_id: str,
    user=Depends(get_current_user)
):
    findings_res = supabase.table("findings")\
        .select("*")\
        .eq("project_id", project_id)\
        .execute()
    
    entities_res = supabase.table("entities")\
        .select("*")\
        .eq("project_id", project_id)\
        .execute()

    project_res = supabase.table("projects")\
        .select("description")\
        .eq("id", project_id)\
        .single()\
        .execute()

    story = await draft(
        entities=entities_res.data,
        findings=findings_res.data,
        context=project_res.data.get("description", "")
    )

    # Save story to project
    supabase.table("projects")\
        .update({"story_draft": story})\
        .eq("id", project_id)\
        .execute()

    return {"draft": story}
