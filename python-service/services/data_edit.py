import pandas as pd
from openpyxl import load_workbook
import io
import json
from typing import Optional, List, Any, Dict, Union


class DataProcessor:
    """
    Handles data processing for components and Excel files.
    
    This class processes component data and optional Excel file data,
    providing methods for data validation, transformation, and analysis.
    """
    
    def __init__(
        self, 
        components_data: Union[Dict, List, pd.DataFrame], 
        excel_data: Optional[List[List[Any]]] = None
    ):
        """
        Initialize DataProcessor with component data and optional Excel data.
        
        Args:
            components_data: Component data as dictionary, list or DataFrame
            excel_data: Optional Excel data as list of rows
            
        Raises:
            ValueError: If components_data cannot be converted to DataFrame
        """
        super().__init__()
        
        # Convert components data to DataFrame
        self.components_df = self._convert_to_dataframe(components_data)
        self.excel_data = excel_data
        
        # Process Excel data if provided
        if self.excel_data:
            self._process_excel_data()
        
        self.result = self._edit_data()
        print("Data successfully processed in Python backend")
    
    def _edit_data(self):
        if self.components_df.empty or self.processed_excel_df.empty:
            raise ValueError("Either components_df or processed_excel_df is not available")
        else:
            self.lines = len(self.processed_excel_df)  # Exclude header row
            result = self._build_nested_json(self.components_df)
            return result
            
    def _build_nested_json(self, df, parent_name="", current_depth=0):
        """
        递归构建嵌套JSON结构，支持任意深度
        """
        result = {}
        
        # 获取当前层级的节点
        if parent_name == "":
            # 顶级节点
            current_nodes = df[df['zparent'] == '']
        else:
            # 子节点
            current_nodes = df[df['zparent'] == parent_name]
        
        for _, node in current_nodes.iterrows():
            node_name = node['znodename']
            
            if node['has_children']:
                # 有子节点，递归构建
                result[node_name] = self._build_nested_json(df, node_name, current_depth + 1)
            else:
                if node['relatedfield']:
                    result[node_name] = self.processed_excel_df[node['relatedfield']].tolist() if node.get(
                        'relatedfield') and node['relatedfield'] in self.processed_excel_df.columns else [""] * self.lines
        
        return result
    
    def _convert_to_dataframe(self, data: Union[Dict, List, pd.DataFrame]) -> pd.DataFrame:
        """
        Convert input data to pandas DataFrame.
        
        Args:
            data: Input data in various formats
            
        Returns:
            pandas DataFrame
            
        Raises:
            ValueError: If data cannot be converted to DataFrame
        """
        try:
            if isinstance(data, pd.DataFrame):
                return data
            elif isinstance(data, dict):
                return pd.DataFrame([data])
            elif isinstance(data, list):
                return pd.DataFrame(data)
            else:
                raise ValueError(f"Unsupported data type: {type(data)}")
        except Exception as e:
            raise ValueError(f"Failed to convert data to DataFrame: {str(e)}")
    
    def _process_excel_data(self, ) -> None:
        """
        Process Excel data and perform necessary transformations.
        
        This method can be extended to include specific Excel data processing logic
        such as data validation, cleaning, or integration with component data.
        """
        if not self.excel_data or len(self.excel_data) == 0:
            return
        
        try:
            # Example: Create DataFrame from Excel data
            # Assuming first row contains headers
            headers = self.excel_data[0]
            rows = self.excel_data[1:]
            
            excel_df = pd.DataFrame(rows, columns=headers)
            
            # Store processed Excel data
            self.processed_excel_df = excel_df
            
            # Example: Print basic info about the Excel data
            print(f"Processed Excel data with {len(excel_df)} rows and {len(excel_df.columns)} columns")
            
        except Exception as e:
            print(f"Warning: Error processing Excel data: {str(e)}")
            self.processed_excel_df = None
    
    def get_component_statistics(self) -> Dict[str, Any]:
        """
        Get basic statistics about the component data.
        
        Returns:
            Dictionary containing component data statistics
        """
        return {
            "row_count": len(self.components_df),
            "column_count": len(self.components_df.columns),
            "columns": list(self.components_df.columns),
            "data_types": self.components_df.dtypes.to_dict()
        }
    
    def get_excel_statistics(self) -> Optional[Dict[str, Any]]:
        """
        Get basic statistics about the Excel data if available.
        
        Returns:
            Dictionary containing Excel data statistics or None if no Excel data
        """
        if not hasattr(self, 'processed_excel_df') or self.processed_excel_df is None:
            return None
        
        return {
            "row_count": len(self.processed_excel_df),
            "column_count": len(self.processed_excel_df.columns),
            "columns": list(self.processed_excel_df.columns)
        }