sap.ui.define([], function () {
    "use strict";

    return {
        nodeKindI18n: function (sKind, oBundle) {
            if (!sKind || !oBundle) return "";
            return oBundle.getText("nodekind." + sKind, sKind);
        },
        nodeTypeI18n: function (sKind, oBundle) {
            if (!sKind || !oBundle) return "";
            return oBundle.getText("nodetype." + sKind, sKind);
        }
    };
});
