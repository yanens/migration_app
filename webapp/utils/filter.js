sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * 递归过滤树形 JSON 数据
         * @param {Array} aNodes - 树的节点数组
         * @param {string} sKey - 属性名，例如 "znodestructure"
         * @param {string} sExcludeValue - 要排除的值，例如 "BAPIUPDATE"
         * @returns {Array} 过滤后的新数组
         */
        filterTreeByProperty: function (aNodes, sKey, sExcludeValue) {
            return aNodes
                .filter(node => node[sKey] !== sExcludeValue) // 过滤掉匹配的节点
                .map(node => {
                    if (node.zcomponents && Array.isArray(node.zcomponents)) {
                        node.zcomponents = this.filterTreeByProperty(node.zcomponents, sKey, sExcludeValue);
                    }
                    return node;
                });
        }
    };
});
