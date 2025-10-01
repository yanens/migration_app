import io
import json
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, UploadFile, Form, HTTPException
import pandas as pd
from openpyxl import load_workbook
from services import data_edit as edit_service
from .abap_post import send_to_sap

router = APIRouter()

@router.get("/hello")
async def get_hello() -> Dict[str, str]:
    """
    Simple health check endpoint to verify API is working.
    
    Returns:
        Dictionary with greeting message
    """
    return {"message": "Hello UI5, this is Python API"}


@router.post("/process")
async def process_data(
    components: str = Form(..., description="JSON string containing component data"),
    file: Optional[UploadFile] = None
) -> Dict[str, str]:
    """
    Process component data and optional Excel file.
    
    Args:
        components: JSON formatted string with component data
        file: Optional Excel file for additional data processing
        
    Returns:
        Dictionary with processing status
        
    Raises:
        HTTPException: If JSON parsing fails or file processing error occurs
    """
    try:
        # Parse JSON component data
        components_data = json.loads(components)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
    
    excel_data = None
    
    # Process Excel file if provided
    if file and file.filename:
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
        
        try:
            file_content = await file.read()
            excel_buffer = io.BytesIO(file_content)
            workbook = load_workbook(excel_buffer, read_only=True)
            worksheet = workbook.active
            
            # Convert all rows to list
            excel_data = [list(row) for row in worksheet.iter_rows(values_only=True)]
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing Excel file: {str(e)}")
    
    # Process data using service
    sap_payload = edit_service.DataProcessor(components_data, excel_data)

    sap_response = send_to_sap(sap_payload.result)

    return {
        "status": "success",
        "message": "Data processed and posted to SAP",
        "sent_payload": sap_payload,
        "sap_response": sap_response
    }


@router.post("/excel/first-row")
async def get_excel_first_row(file: Optional[UploadFile] = None) -> Dict[str, Optional[List[Any]]]:
    """
    Extract and return the first row of an Excel file.
    
    Args:
        file: Excel file to process
        
    Returns:
        Dictionary containing the first row data
        
    Raises:
        HTTPException: If file processing fails or invalid file type
    """
    first_row = None
    
    if file and file.filename:
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
        
        try:
            file_content = await file.read()
            excel_buffer = io.BytesIO(file_content)
            workbook = load_workbook(excel_buffer, read_only=True)
            worksheet = workbook.active
            
            # Get first row and convert to list
            first_row = list(next(worksheet.iter_rows(values_only=True)))
            
        except StopIteration:
            raise HTTPException(status_code=400, detail="Excel file is empty")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")
    
    return {"first_row": first_row}