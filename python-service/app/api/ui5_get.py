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
) -> Dict[str, Any]:
    """
    Process component data and optional Excel file, then send to SAP.
    
    This endpoint accepts component data in JSON format and an optional Excel file,
    processes them using the DataProcessor service, and sends the result to SAP OData service.
    
    Args:
        components: JSON formatted string with component data structure
        file: Optional Excel file containing additional data for processing
        
    Returns:
        Dictionary containing processing status, SAP response, and payload information
        
    Raises:
        HTTPException: If JSON parsing fails, file processing error occurs, or SAP communication fails
    """
    try:
        # Parse JSON component data
        components_data = json.loads(components)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
    
    excel_data = None
    
    # Process Excel file if provided
    if file and file.filename:
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
        
        try:
            # Read and process Excel file content
            file_content = await file.read()
            excel_buffer = io.BytesIO(file_content)
            workbook = load_workbook(excel_buffer, read_only=True)
            worksheet = workbook.active
            
            # Convert all worksheet rows to list format
            excel_data = [list(row) for row in worksheet.iter_rows(values_only=True)]
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing Excel file: {str(e)}")
    
    try:
        # Process data using DataProcessor service
        data_processor = edit_service.DataProcessor(components_data, excel_data)
        
        # Send processed data to SAP OData service
        sap_response = send_to_sap(data_processor.result)
        
        return {
            "status": "success",
            "message": "Data processed and posted to SAP successfully",
            "sent_payload": data_processor.result,
            "sap_response": sap_response
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error during data processing or SAP communication: {str(e)}"
        )


@router.post("/excel/first-row")
async def get_excel_first_row(file: UploadFile) -> Dict[str, Optional[List[Any]]]:
    """
    Extract and return the first row of an Excel file.
    
    This endpoint is useful for previewing Excel file structure and headers
    before full processing.
    
    Args:
        file: Excel file to process (required)
        
    Returns:
        Dictionary containing the first row data as list of values
        
    Raises:
        HTTPException: If file processing fails, invalid file type, or file is empty
    """
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    try:
        # Read and process Excel file
        file_content = await file.read()
        excel_buffer = io.BytesIO(file_content)
        workbook = load_workbook(excel_buffer, read_only=True)
        worksheet = workbook.active
        
        # Get first row and convert to list
        first_row_iterator = worksheet.iter_rows(values_only=True)
        first_row = list(next(first_row_iterator))
        
        return {"first_row": first_row}
        
    except StopIteration:
        raise HTTPException(status_code=400, detail="Excel file is empty")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")


@router.post("/validate-components")
async def validate_components_json(components: str = Form(..., description="JSON string to validate")) -> Dict[str, Any]:
    """
    Validate component JSON structure without processing.
    
    This endpoint allows clients to validate their component JSON structure
    before submitting for full processing.
    
    Args:
        components: JSON formatted string with component data to validate
        
    Returns:
        Dictionary containing validation results and structure information
        
    Raises:
        HTTPException: If JSON parsing fails or structure is invalid
    """
    try:
        components_data = json.loads(components)
        
        # Basic structure validation
        if not isinstance(components_data, (dict, list)):
            raise ValueError("Components data must be a dictionary or list")
        
        # Additional validation logic can be added here
        # For example, check for required fields, data types, etc.
        
        return {
            "status": "valid",
            "message": "Component JSON structure is valid",
            "data_type": type(components_data).__name__,
            "sample_keys": list(components_data.keys()) if isinstance(components_data, dict) else f"List with {len(components_data)} items"
        }
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")