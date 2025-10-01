sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "migrationapp/utils/filter",
    "sap/ui/base/Event",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/Button"
], (
    Controller,
    JSONModel,
    filter,
    Event,
    MessageToast,
    Dialog,
    List,
    StandardListItem,
    Button
) => {
    "use strict";
    
    // Global variable for selection tracking
    this._lastSelection = this._lastSelection || [];
    this._fullcomponents = this._fullcomponents || [];
    
    return Controller.extend("migrationapp.controller.Main", {
        
        // ====================================================
        // LIFECYCLE METHODS
        // ====================================================
        
        /**
         * Initialize controller
         */
        onInit: function() {
            // Set default BAPI name
            this.byId("bapiNameInput").setValue("BAPI_SALESORDER_CREATEFROMDAT2");
        },
        
        /**
         * Handle after rendering to apply custom styles
         */
        onAfterRendering: function() {
            this._applyCustomStyles();
        },
        
        // ====================================================
        // FORMATTING METHODS
        // ====================================================
        
        /**
         * Format node kind for display
         * @param {string} sKind - Node kind
         * @returns {string} Formatted text
         */
        onFormatNodeKind: function(sKind) {
            if (!sKind) return "";
            return this._getText("nodekind." + sKind.toUpperCase());
        },
        
        /**
         * Format node type for display
         * @param {string} sType - Node type
         * @returns {string} Formatted text
         */
        onFormatNodeType: function(sType) {
            if (!sType) return "";
            return this._getText("nodetype." + sType.toUpperCase());
        },
        
        // ====================================================
        // EVENT HANDLERS - USER ACTIONS
        // ====================================================
        
        /**
         * Handle BAPI info fetch button press
         */
        onFetchBAPIInfoButtonPress: function() {
            const sBapiName = this.byId("bapiNameInput").getValue().trim();
            
            // Validate BAPI name input
            if (!sBapiName) {
                MessageToast.show(this._getText("validation.enterValidBapiName"));
                return;
            }

            // Build service URL and load JSON data
            const oModel = this.getOwnerComponent().getModel();
            const sKey = oModel.createKey("/BAPIINFOSet", {
                Bapiname: sBapiName
            });
            const sServiceUrl = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService/uri");
            const sUrl = sServiceUrl + sKey + "/$value";
            
            this._loadJsonStream(sUrl);
        },
        
        /**
         * Handle file uploader change event
         * @param {sap.ui.base.Event} oEvent - File upload event
         */
        onFileUploaderChange: function(oEvent) {
            const oFileUploader = this.byId("fileUploader");
            const aFiles = oEvent.getParameter("files");
            
            if (aFiles && aFiles.length > 0) {
                this._oFile = aFiles[0];
                
                // Validate file type before sending
                const fileName = this._oFile.name;
                if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
                    oFileUploader.setValue("");
                    MessageToast.show(this._getText("error.invalidFileType"));
                    return;
                }
                
                const formData = new FormData();
                formData.append("file", this._oFile);
                
                // Send file to backend for processing
                fetch("http://localhost:8000/api/ui5_get/excel/first-row", {
                    method: "POST",
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(errorData => {
                            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    // Process header data from Excel file
                    this._headerRow = data.first_row;
                    
                    let columnObjects;
                    if (this._headerRow && this._headerRow.length > 0) {
                        columnObjects = this._headerRow.map((col, index) => ({ 
                            key: `${index}`, 
                            text: col || "" 
                        }));
                    } else {
                        columnObjects = [{ 
                            key: "0", 
                            text: this._getText("fileUpload.emptyfile") 
                        }];
                    }
                    
                    // Update header model with column data
                    const oJSONModelHeader = new JSONModel();
                    const headerData = { columns: columnObjects };
                    oJSONModelHeader.setData(headerData);
                    this.getView().setModel(oJSONModelHeader, "headerModel");
                    
                    MessageToast.show(this._getText("fileUpload.success"));
                })
                .catch(error => {
                    oFileUploader.setValue("");
                    console.error("Error processing Excel file:", error);
                    
                    let errorMessage = this._getText("error.failedToSendRequest");
                    if (error.message.includes("Only Excel files") || error.message.includes("empty")) {
                        errorMessage = error.message;
                    } else if (error.message.includes("HTTP error")) {
                        errorMessage = this._getText("error.serverError");
                    }
                    
                    MessageToast.show(errorMessage);
                });
            }
        },

        /**
         * Handle edit button press to send data to backend
         * @param {sap.ui.base.Event} oEvent - Button press event
         */
        onEditButtonPress: function(oEvent) {
            const formData = new FormData();

            // Get tree table data
            // const oTreeTable = this.byId("componentsTreeTable");
            // const oModel = oTreeTable.getModel();
            // const oTableData = oModel.getProperty("/");
            
            this._editFullComponents();

            // Validate tree table data
            if (!_fullcomponents || Object.keys(_fullcomponents).length === 0) {
                MessageToast.show(this._getText("error.noDataToSend"));
                return;
            }
            
            try {
                const componentsJson = JSON.stringify(_fullcomponents);
                formData.append("components", componentsJson);
            } catch (error) {
                console.error("Error stringifying components data:", error);
                MessageToast.show(this._getText("error.invalidDataFormat"));
                return;
            }

            // Add file if available
            if (this._oFile) {
                // Validate file type before sending
                const fileName = this._oFile.name;
                if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
                    MessageToast.show(this._getText("error.invalidFileType"));
                    return;
                }
                formData.append("file", this._oFile);
            }

            // Show loading indicator
            const oButton = oEvent.getSource();
            oButton.setEnabled(false);
            
            // Send data to backend for processing
            fetch("http://localhost:8000/api/ui5_get/process", {
                method: "POST",
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                MessageToast.show(this._getText("message.editRequestSent"));
                console.log("Backend response:", data);
            })
            .catch(error => {
                console.error("Error sending process request:", error);
                
                let errorMessage = this._getText("error.failedToSendRequest");
                if (error.message.includes("Invalid JSON format")) {
                    errorMessage = this._getText("error.invalidJsonFormat");
                } else if (error.message.includes("Only Excel files")) {
                    errorMessage = this._getText("error.invalidFileType");
                } else if (error.message.includes("Error processing Excel file")) {
                    errorMessage = this._getText("error.excelProcessingError");
                } else if (error.message.includes("HTTP error")) {
                    errorMessage = this._getText("error.serverError");
                }
                
                MessageToast.show(errorMessage);
            })
            .finally(() => {
                // Re-enable button
                oButton.setEnabled(true);
            });
        },

        /**
         * Open multi-select dialog for field selection
         * @param {sap.ui.base.Event} oEvent - Button press event
         */
        onOpenMultiSelectDialog: function(oEvent) {
            const oButton = oEvent.getSource();
            const oModel = this.getView().getModel();
            const oTable = this.byId("componentsTreeTable");
            
            // Find the row containing the clicked button
            const oRow = oTable.getRows().find(row => row.getDomRef().contains(oButton.getDomRef()));
            const iRowIndex = oRow.getIndex();
            const oContext = oTable.getContextByIndex(iRowIndex);
            const sPath = oContext.getPath();

            // Create dialog if it doesn't exist
            if (!this._oMultiSelectDialog) {
                this._oMultiSelectDialog = new Dialog({
                    title: this._getText("dialog.selectField.title"),
                    content: [
                        new List({
                            id: this.createId("fieldSelectionList"),
                            mode: "MultiSelect",
                            items: {
                                path: "headerModel>/columns",
                                template: new StandardListItem({
                                    title: "{headerModel>text}",
                                    type: "Active"
                                })
                            }
                        })
                    ],
                    beginButton: new Button({
                        text: this._getText("button.ok"),
                        press: function() {
                            // Get selected items and update model
                            const oList = this.byId("fieldSelectionList");
                            const selectedItems = oList.getSelectedItems();
                            const selectedKeys = selectedItems.map(item => item.getBindingContext("headerModel").getObject().key);
                            const selectedTexts = selectedItems.map(item => item.getBindingContext("headerModel").getObject().text);

                            const currentPath = this._oMultiSelectDialog.data("currentPath");
                            const oRowData = oModel.getProperty(currentPath);
                            oRowData.relatedkey = selectedKeys.join(",");
                            oRowData.relatedfield = selectedTexts.join(",");
                            
                            oModel.setProperty(currentPath, oRowData);
                            this._oMultiSelectDialog.close();
                        }.bind(this)
                    }),
                    endButton: new Button({
                        text: this._getText("button.cancel"),
                        press: function() {
                            this._oMultiSelectDialog.close();
                        }.bind(this)
                    })
                });
                
                this.getView().addDependent(this._oMultiSelectDialog);
            }

            // Store current path in dialog data
            this._oMultiSelectDialog.data("currentPath", sPath);

            // Set up list selection
            const oList = this.byId("fieldSelectionList");
            oList.removeSelections();

            // Pre-select previously selected items
            const oRowData = oModel.getProperty(sPath);
            if (oRowData.relatedfield) {
                const selectedTexts = oRowData.relatedfield.split(", ");
                oList.getItems().forEach(item => {
                    const itemText = item.getBindingContext("headerModel").getObject().text;
                    if (selectedTexts.includes(itemText)) {
                        oList.setSelectedItem(item, true);
                    }
                });
            }

            this._oMultiSelectDialog.open();
        },
        
        // ====================================================
        // TREE TABLE EVENT HANDLERS
        // ====================================================
        
        /**
         * Handle tree table toggle open state
         * @param {sap.ui.base.Event} oEvent - Toggle event
         */
        onTreeTableToggleOpenState: function(oEvent) {
            const oTreeTable = oEvent.getSource();
            const bExpanded = oEvent.getParameter("expanded");
            
            // Restore selection when expanding
            if (bExpanded) {
                _lastSelection.forEach(sPath => {
                    let iIndex = this._getRowIndexByPath(oTreeTable, sPath);
                    oTreeTable.addSelectionInterval(iIndex, iIndex);
                });
            }
        },

        /**
         * Handle tree table rows updated event
         * @param {sap.ui.base.Event} oEvent - Rows updated event
         */
        onTreeTableRowsUpdated: function(oEvent) {
            // Additional row update logic can be added here if needed
        },

        /**
         * Handle tree table row selection change
         * @param {sap.ui.base.Event} oEvent - Selection change event
         */
        onTreeTableRowSelectionChange: function(oEvent) {
            const oTreeTable = oEvent.getSource();
            const iRowIndex = oEvent.getParameter("rowIndex");

            const oContext = oTreeTable.getContextByIndex(iRowIndex);
            if (!oContext) return;

            const oNode = oContext.getObject();
            let sPath = oContext.getPath();
            const bSelected = oTreeTable.isIndexSelected(iRowIndex);

            // Update selection state
            if (bSelected) {
                if (_lastSelection.includes(sPath)) {
                    return;
                } else {
                    oNode.zselected = true;
                    _lastSelection.push(sPath);
                }
            } else {
                _lastSelection.splice(_lastSelection.indexOf(sPath), 1);
                oNode.zselected = false;
            }

            // Propagate selection to children and parents
            if (bSelected) {
                this._selectChildren(oTreeTable, sPath, oNode);
                this._selectParents(oTreeTable, sPath);
            } else {
                this._deselectChildren(oTreeTable, sPath, oNode);
                this._deselectParentsIfNeeded(oTreeTable, sPath);
            }
        },
        
        // ====================================================
        // PRIVATE METHODS - SELECTION MANAGEMENT
        // ====================================================
        
        /**
         * Recursively select all children nodes
         * @param {sap.ui.table.TreeTable} oTreeTable - Tree table instance
         * @param {string} sPath - Current node path
         * @param {object} oNode - Current node object
         */
        _selectChildren: function(oTreeTable, sPath, oNode) {
            if (!oNode.zcomponents) return;
            
            oNode.zcomponents.forEach((child, idx) => {
                let sChildPath = `${sPath}/zcomponents/${idx}`;
                let iIndex = this._getRowIndexByPath(oTreeTable, sChildPath);
                if (iIndex >= 0) {
                    oTreeTable.addSelectionInterval(iIndex, iIndex);
                    _lastSelection.push(sChildPath);
                    child.zselected = true;
                    this._selectChildren(oTreeTable, sChildPath, child);
                }
            });
        },
        
        /**
         * Recursively deselect all children nodes
         * @param {sap.ui.table.TreeTable} oTreeTable - Tree table instance
         * @param {string} sPath - Current node path
         * @param {object} oNode - Current node object
         */
        _deselectChildren: function(oTreeTable, sPath, oNode) {
            if (!oNode.zcomponents) return;
            
            oNode.zcomponents.forEach((child, idx) => {
                let sChildPath = `${sPath}/zcomponents/${idx}`;
                let iIndex = this._getRowIndexByPath(oTreeTable, sChildPath);
                if (iIndex >= 0) {
                    oTreeTable.removeSelectionInterval(iIndex, iIndex);
                    _lastSelection.splice(_lastSelection.indexOf(sChildPath), 1);
                    child.zselected = false;
                    this._deselectChildren(oTreeTable, sChildPath, child);
                }
            });
        },
        
        /**
         * Recursively select parent nodes
         * @param {sap.ui.table.TreeTable} oTreeTable - Tree table instance
         * @param {string} sPath - Current node path
         */
        _selectParents: function(oTreeTable, sPath) {
            let sParentPath = sPath.replace(/\/zcomponents\/\d+$/, "");
            if (!sParentPath || sParentPath === "/zcomponents") return;

            let iParentIndex = this._getRowIndexByPath(oTreeTable, sParentPath);
            if (iParentIndex >= 0) {
                oTreeTable.addSelectionInterval(iParentIndex, iParentIndex);
                _lastSelection.push(sParentPath);
                oTreeTable.getModel().getProperty(sParentPath).zselected = true;
                this._selectParents(oTreeTable, sParentPath);
            }
        },
        
        /**
         * Recursively deselect parent nodes if no children are selected
         * @param {sap.ui.table.TreeTable} oTreeTable - Tree table instance
         * @param {string} sPath - Current node path
         */
        _deselectParentsIfNeeded: function(oTreeTable, sPath) {
            let sParentPath = sPath.replace(/\/zcomponents\/\d+$/, "");
            if (!sParentPath || sParentPath === "/zcomponents") return;

            const oModel = oTreeTable.getModel();
            const oParentNode = oModel.getProperty(sParentPath);

            // Check if any children are still selected
            const anySelected = (oParentNode.zcomponents || []).some((child, idx) => {
                let sChildPath = `${sParentPath}/zcomponents/${idx}`;
                let iChildIndex = this._getRowIndexByPath(oTreeTable, sChildPath);
                return iChildIndex >= 0 && oTreeTable.isIndexSelected(iChildIndex);
            });

            // Deselect parent if no children are selected
            if (!anySelected) {
                let iParentIndex = this._getRowIndexByPath(oTreeTable, sParentPath);
                if (iParentIndex >= 0) {
                    oTreeTable.removeSelectionInterval(iParentIndex, iParentIndex);
                    _lastSelection.splice(_lastSelection.indexOf(sParentPath), 1);
                    oTreeTable.getModel().getProperty(sParentPath).zselected = false;
                    this._deselectParentsIfNeeded(oTreeTable, sParentPath);
                }
            }
        },
        
        /**
         * Get row index by path in tree table
         * @param {sap.ui.table.TreeTable} oTreeTable - Tree table instance
         * @param {string} sPath - Node path
         * @returns {number} Row index or -1 if not found
         */
        _getRowIndexByPath: function(oTreeTable, sPath) {
            const iLength = oTreeTable.getBinding("rows").getLength();
            for (let i = 0; i < iLength; i++) {
                const oCtx = oTreeTable.getContextByIndex(i);
                if (oCtx && oCtx.getPath() === sPath) {
                    return i;
                }
            }
            return -1;
        },
        
        // ====================================================
        // PRIVATE METHODS - UI MANAGEMENT
        // ====================================================
        
        /**
         * Apply custom styles to tree table columns
         */
        _applyCustomStyles: function() {
            const oTable = this.byId("componentsTreeTable");
            if (oTable) {
                oTable.addStyleClass("customTreeTable");
                
                // Set column widths
                const aColumns = oTable.getColumns();
                aColumns.forEach(function(oColumn) {
                    if (oColumn.getId().includes("nodeNameColumn")) {
                        oColumn.setWidth("250px");
                    } else if (oColumn.getId().includes("nodeKindColumn")) {
                        oColumn.setWidth("100px");
                    } else if (oColumn.getId().includes("nodeStructureColumn")) {
                        oColumn.setWidth("150px");
                    } else if (oColumn.getId().includes("dataTypeColumn")) {
                        oColumn.setWidth("100px");
                    } else if (oColumn.getId().includes("descriptionColumn")) {
                        oColumn.setWidth("350px");
                    } else if (oColumn.getId().includes("addFieldColumn")) {
                        oColumn.setWidth("50px");
                    } else if (oColumn.getId().includes("relatedFieldColumn")) {
                        oColumn.setWidth("200px");
                    } 
                });
            }
        },
        
        // ====================================================
        // UTILITY METHODS
        // ====================================================

        /**
         * Load JSON data from stream URL
         * @param {string} sUrl - Service URL
         */
        _loadJsonStream: async function(sUrl) {
            const oJSONModel = new JSONModel();

            try {
                // Fetch data from backend service
                const response = await fetch(sUrl, {
                    method: "GET",
                    headers: {
                        "Accept": "text/plain"
                    }
                });

                const textData = await response.text();
                const json = JSON.parse(textData);
                _fullcomponents  = JSON.parse(JSON.stringify(json.zcomponents || []));

                // Filter tree data and set model
                json.zcomponents = filter.filterTreeByProperty(json.zcomponents, "znodestructure", "BAPIUPDATE");
                oJSONModel.setData(json);
                this.getView().setModel(oJSONModel);
                this.byId("bapiDescriptionText").setText(json.bapitext || "");

            } catch (err) {
                console.error("Fetch Stream failed:", err);
                MessageToast.show(this._getText("error.fetchDataFailed"));
            }
        },

        _editFullComponents: function() {
            const oTreeTable = this.byId("componentsTreeTable");
            const oModel = oTreeTable.getModel();
            const oTableData = oModel.getProperty("/");
            
            // Recursively update selection status in full components tree
            if (oTableData.zcomponents && _fullcomponents) {
                this._updateFullComponentsSelection(oTableData.zcomponents, _fullcomponents);
            }
            
            return _fullcomponents;
        },

        /**
         * Recursively update selection status in full components tree
         * @param {Array} filteredComponents - Filtered components data (from table)
         * @param {Array} fullComponents - Full components data
         */
        _updateFullComponentsSelection: function(filteredComponents, fullComponents) {
            if (!filteredComponents || !fullComponents) return;
            
            filteredComponents.forEach((filteredItem, index) => {
                // Find matching node in full components tree
                const fullItem = this._findMatchingNode(fullComponents, filteredItem, index);
                
                if (fullItem) {
                    fullItem.relatedkey = filteredItem.relatedkey;
                    fullItem.relatedfield = filteredItem.relatedfield;

                    // If node is selected in filtered tree, set selection status in full tree
                    if (filteredItem.zselected) {
                        fullItem.zselected = true;
                        
                        // Also set selection status for nodes with parent+"X" and same node name
                        this._setParentXNodesSelection(_fullcomponents, fullItem);
                    }
                    
                    // Recursively process child components
                    if (filteredItem.zcomponents && filteredItem.zcomponents.length > 0 && 
                        fullItem.zcomponents && fullItem.zcomponents.length > 0) {
                        this._updateFullComponentsSelection(filteredItem.zcomponents, fullItem.zcomponents);
                    }
                }
            });
        },

        /**
         * Find matching node in full components tree
         * @param {Array} fullComponents - Full components tree
         * @param {Object} filteredItem - Node from filtered tree
         * @param {number} index - Current index
         * @returns {Object|null} Matching node
         */
        _findMatchingNode: function(fullComponents, filteredItem, index) {
            // First try to find by index position (assuming same structure)
            if (fullComponents[index] && 
                fullComponents[index].znodename === filteredItem.znodename &&
                fullComponents[index].znodekind === filteredItem.znodekind) {
                return fullComponents[index];
            }
            
            // Fallback: search by properties if index doesn't match
            return this._findNodeByProperties(fullComponents, filteredItem);
        },

        /**
         * Find node by comparing properties in the tree
         * @param {Array} components - Components array
         * @param {Object} targetItem - Target node to find
         * @returns {Object|null} Found node
         */
        _findNodeByProperties: function(components, targetItem) {
            if (!components || !targetItem) return null;
            
            for (let i = 0; i < components.length; i++) {
                const component = components[i];
                
                // Compare key properties to identify matching node
                if (component.znodename === targetItem.znodename &&
                    component.znodekind === targetItem.znodekind &&
                    component.znodestructure === targetItem.znodestructure) {
                    return component;
                }
                
                // Recursively search in child components
                if (component.zcomponents && component.zcomponents.length > 0) {
                    const foundInChildren = this._findNodeByProperties(component.zcomponents, targetItem);
                    if (foundInChildren) return foundInChildren;
                }
            }
            
            return null;
        },

        /**
         * Set selection status for nodes with parent+"X" and same name
         * @param {Array} fullComponents - Full components tree
         * @param {Object} selectedItem - Selected node
         */
        _setParentXNodesSelection: function(fullComponents, selectedItem) {
            if (!selectedItem || !selectedItem.zparent) return;
            
            // Find nodes with parent name + "X" and same node name
            const parentXName = selectedItem.zparent + "X";
            
            // Recursively find and select matching nodes
            this._findAndSelectParentXNodes(fullComponents, parentXName, selectedItem.znodename);
        },

        /**
         * Recursively find and select nodes with parent+"X" and same name
         * @param {Array} components - Components array
         * @param {string} parentXName - Parent name + "X"
         * @param {string} nodeName - Node name to match
         */
        _findAndSelectParentXNodes: function(components, parentXName, nodeName) {
            if (!components) return;
            
            components.forEach(component => {
                // Check if node matches parent+"X" and has same name
                if (component.zparent === parentXName && component.znodename === nodeName) {
                    component.zselected = true;
                }
                
                // Recursively process child components
                if (component.zcomponents && component.zcomponents.length > 0) {
                    this._findAndSelectParentXNodes(component.zcomponents, parentXName, nodeName);
                }
            });
        },

        /**
         * Helper method to get i18n text
         * @param {string} sKey - Translation key
         * @param {string[]=} [aArgs] - Optional arguments for placeholder replacement
         * @returns {string} Translated text
         */
        _getText: function(sKey, aArgs = []) {
            const oBundle = this.getView().getModel("i18n").getResourceBundle();
            return aArgs ? oBundle.getText(sKey, aArgs) : oBundle.getText(sKey);
        }
    });
});