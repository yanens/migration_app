from fastapi import APIRouter, HTTPException
from typing import Dict
import requests
import json
from requests.auth import HTTPBasicAuth

router = APIRouter()

# SAP OData service configuration
SAP_BASE_URL = "http://vhcalhdbdb.dummy.nodomain:50000/sap/opu/odata/sap/ZY_MIGRATION_SRV"
SAP_USER = "TCSC0100"
SAP_PASS = "Yy469919"

# Create persistent session for connection reuse
session = requests.Session()


def send_to_sap(payload: Dict) -> Dict:
    """
    Core function: Send JSON data to SAP OData service.
    
    This function can be directly called by other modules to send data to SAP.
    It handles the HTTP PUT request with proper authentication and headers.
    
    Args:
        payload: Dictionary containing the data to be sent to SAP
        
    Returns:
        Dictionary containing the response status and data from SAP
        
    Raises:
        HTTPException: If SAP returns an error status code
    """
    entity_set = "DBDATASet"
    url = f"{SAP_BASE_URL}/{entity_set}('1')/$value"
    
    # Set appropriate headers for SAP OData service
    headers = {
        "Content-Type": "application/octet-stream",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }

    def json_stream():
        """
        Generator function to stream JSON data in chunks.
        
        This approach is memory efficient for large payloads.
        """
        yield json.dumps(payload)

    # Send PUT request to SAP OData service
    post_resp = session.put(
        url,
        data=json_stream(),
        headers=headers,
        auth=HTTPBasicAuth(SAP_USER, SAP_PASS),
        stream=True,
        verify=False  # Disable SSL verification for development
    )

    # Check for successful response codes
    if post_resp.status_code in [200, 201, 204]:
        return {"status": "success", "data": post_resp.json()}
    else:
        raise HTTPException(
            status_code=post_resp.status_code,
            detail=f"SAP returned error: {post_resp.text}"
        )


@router.post("/post_to_sap")
async def post_json_to_sap(payload: Dict):
    """
    FastAPI route wrapper that calls the core send_to_sap function.
    
    This endpoint accepts JSON data and forwards it to the SAP OData service.
    
    Args:
        payload: Dictionary containing the data to be sent to SAP
        
    Returns:
        Dictionary containing the response from SAP OData service
        
    Raises:
        HTTPException: If SAP service returns an error
    """
    return send_to_sap(payload)


@router.get("/health_check")
async def sap_health_check():
    """
    Health check endpoint to verify SAP OData service connectivity.
    
    Returns:
        Dictionary containing service status information
    """
    try:
        test_url = f"{SAP_BASE_URL}/$metadata"
        response = session.get(
            test_url,
            auth=HTTPBasicAuth(SAP_USER, SAP_PASS),
            verify=False
        )
        
        if response.status_code == 200:
            return {
                "status": "healthy",
                "service": "SAP OData",
                "message": "Successfully connected to SAP OData service"
            }
        else:
            return {
                "status": "unhealthy",
                "service": "SAP OData",
                "message": f"Service responded with status: {response.status_code}"
            }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to SAP OData service: {str(e)}"
        )